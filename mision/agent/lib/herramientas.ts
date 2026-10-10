// Definiciones compartidas: los subagentes declarados no heredan tools del root, así que cada uno re-exporta las suyas.
import { defineState } from "eve/context";
import { defineTool } from "eve/tools";
import { grep } from "eve/tools/grep";
import { readFile } from "eve/tools/read_file";
import { writeFile } from "eve/tools/write_file";
import { z } from "zod";

import * as caja from "./caja";

// ponytail: tope por sesión, no por día. 8.000 req/día por token: vigía ~1.500/día + una misión <= 400 queda lejos.
const TOPE_MENSAJES = 400;
const gasto = defineState("mision.gasto", () => ({ mensajes: 0 }));
// Un paso de workflow muere a los 300 s (Hobby). probe.py espera hasta 10 s por request sin forma de bajarlo por env:
// (12 + reset) × 10,12 s ≈ 132 s en el peor caso, más la llamada al modelo del mismo paso. caja.seq corta a 140 s.
const MAX_MENSAJES = caja.MAX_MENSAJES_SEQ;

export const sondear = defineTool({
  description:
    "Manda una seq al servicio ORIGINAL vía tools/probe.py: hace /__reset y luego cada mensaje por POST /msg. " +
    "Todo queda registrado en experimentos.jsonl con id. Agrupa por hipótesis; no repitas una seq ya registrada. " +
    "Cada mensaje es 'CMD;arg;...;control' con el control bien calculado (si no, E202 tapa todo). " +
    `Máximo ${MAX_MENSAJES} mensajes por llamada y UNA llamada por turno (tope de 300 s por paso). ` +
    "Antes de sondear, mira con `evidencia` si el log ya lo responde.",
  inputSchema: z.object({
    seq: z.string().regex(/^m-[a-z0-9-]{3,60}$/, "nombre único que empiece por m- (misión)"),
    hipotesis: z.string().min(10),
    mensajes: z.array(z.string()).min(1).max(MAX_MENSAJES),
  }),
  async execute({ seq, hipotesis, mensajes }, ctx) {
    const { mensajes: usados } = gasto.get();
    if (usados + mensajes.length + 1 > TOPE_MENSAJES) {
      throw new Error(`presupuesto de la sesión agotado (${usados}/${TOPE_MENSAJES}); concluye con lo que hay`);
    }
    gasto.update((g) => ({ mensajes: g.mensajes + mensajes.length + 1 }));
    const filas = await caja.seq(ctx, seq, hipotesis, mensajes);
    if (filas.some((f) => f.infra)) throw new Error("respuesta de infraestructura (rate-limit): espera y baja el ritmo");
    return filas.map(({ id, request, status, response }) => ({ id, request, status, response }));
  },
});

export const concluir = defineTool({
  description: "Agrega la conclusión a una fila del log (probe.py concluir). Nunca edites experimentos.jsonl a mano.",
  inputSchema: z.object({ id: z.number().int().positive(), texto: z.string().min(5) }),
  execute: ({ id, texto }, ctx) => caja.concluir(ctx, id, texto),
});

export const verificar = defineTool({
  description:
    "Compuerta de paridad: regla 2 (el reemplazo no llama a nadie), log solo crece, tests/ intactos desde que el " +
    "tester los fijó, pnpm build, servidor de cero en :3111, tools/replay.py de TODO el log y la suite e2e completa. " +
    "ok:false trae la etapa y las diferencias. " +
    "Si devuelve pendiente: true, sigue corriendo en el sandbox; vuelve a llamarla (no relances otra cosa).",
  inputSchema: z.object({}),
  execute: (_input, ctx) => caja.verificar(ctx),
});

export const correr_e2e = defineTool({
  description:
    "Corre la suite e2e (tester-army/e2e, tests/**/*.e2e.ts) contra el reemplazo actual construido y arrancado de " +
    "cero en :3111. Devuelve ok y la salida (qué test falló y por qué). No toca el original. " +
    "Si devuelve pendiente: true, sigue corriendo en el sandbox; vuelve a llamarla (no relances otra cosa).",
  inputSchema: z.object({}),
  execute: (_input, ctx) => caja.correrE2e(ctx),
});

export const fijar_tests = defineTool({
  description:
    "Fija los tests de la misión: commit de tests/ (y del log de la exploración) en la rama y push de respaldo. Desde " +
    "aquí la compuerta rechaza cualquier cambio en tests/. Llamar UNA vez, cuando los tests están escritos y fallan " +
    "por la razón esperada (el comando aún no existe).",
  inputSchema: z.object({ resumen: z.string().min(10).max(60) }),
  execute: ({ resumen }, ctx) => caja.fijarTests(ctx, resumen),
});

export const evidencia = defineTool({
  description:
    "Busca en experimentos.jsonl (desde la versión vigente, tools/version_vigente.json, salvo `desde`) las filas cuya " +
    "línea cruda casa con `patron` (regex de Python: un comando, un código de error, un nombre de seq). Devuelve filas " +
    "compactas {id, seq, m, status, resp, concl} (las más nuevas, como mucho `max`) y el total. Es la ÚNICA forma de " +
    "leer el log: nunca lo abras con read_file/grep (737 KB, un solo read gasta ~200k tokens). No toca el original.",
  inputSchema: z.object({
    patron: z.string().min(2),
    desde: z.number().int().positive().optional(),
    max: z.number().int().min(1).max(80).optional(),
  }),
  execute: ({ patron, desde, max }, ctx) => caja.evidencia(ctx, patron, desde, max ?? 40),
});

// Archivos grandes del repo (experimentos.jsonl 737 KB, spec/especificacion.md 66 KB, docs/api/msg.md 70 KB,
// openapi.yaml 53 KB). Cada turno reenvía todo el contexto: un read entero se paga en cada llamada siguiente.
const MAX_LINEAS = 250;
const MAX_CARACTERES = 24_000;
const PROHIBIDO = /experimentos\.jsonl/;
// execute de un tool puede devolver un valor o un AsyncIterable de progreso: el resultado es el último valor.
async function final<T extends object>(r: T | AsyncIterable<T> | Promise<T | AsyncIterable<T>>): Promise<T> {
  const v = await r;
  if (!(Symbol.asyncIterator in v)) return v;
  let ultimo: T | undefined;
  for await (const x of v as AsyncIterable<T>) ultimo = x;
  if (ultimo === undefined) throw new Error("la herramienta no devolvió resultado");
  return ultimo;
}
const recortar = (texto: string, como: string) =>
  texto.length <= MAX_CARACTERES
    ? texto
    : `${texto.slice(0, MAX_CARACTERES)}\n… [recortado a ${MAX_CARACTERES} caracteres: ${como}]`;

/** read_file con ventana: como mucho 250 líneas y 24.000 caracteres por llamada; el log, nunca. */
export const leer = defineTool({
  ...readFile,
  description:
    `Lee un archivo del sandbox por rangos: como mucho ${MAX_LINEAS} líneas por llamada (offset/limit, 1-based). ` +
    "Localiza primero con grep (número de línea) y lee solo esa zona; nunca un archivo grande entero. " +
    "experimentos.jsonl no se lee aquí: usa `evidencia`.",
  async execute(input, ctx) {
    if (PROHIBIDO.test(input.filePath)) throw new Error("experimentos.jsonl se consulta con `evidencia`, no con read_file");
    const r = await final(readFile.execute({ ...input, limit: Math.min(input.limit ?? MAX_LINEAS, MAX_LINEAS) }, ctx));
    return { ...r, content: recortar(r.content, "pide un rango menor con offset/limit") };
  },
});

/** grep con tope: 30 coincidencias por archivo, salida recortada, y nunca sobre el log. */
export const buscar = defineTool({
  ...grep,
  description:
    "Busca con regex en archivos del sandbox y devuelve líneas con su número (para luego leer ese rango con " +
    "read_file). Da siempre `path` concreto (p. ej. /workspace/repo/lib/service.ts). Como mucho 30 coincidencias " +
    "por archivo. experimentos.jsonl no se busca aquí: usa `evidencia`.",
  async execute(input, ctx) {
    if (PROHIBIDO.test(`${input.path ?? ""} ${input.glob ?? ""}`)) {
      throw new Error("experimentos.jsonl se consulta con `evidencia`");
    }
    // Sin path, el grep barre el repo entero, log incluido: se limita a código y documentos.
    const acotado = input.path ? input : { ...input, path: "/workspace/repo", glob: input.glob ?? "*.{ts,md,yaml,py}" };
    const r = await final(grep.execute({ ...acotado, limit: Math.min(input.limit ?? 30, 30) }, ctx));
    return { ...r, content: recortar(r.content, "afina el patrón o el path") };
  },
});

// Reescribir entero un archivo grande cuesta su tamaño en salida y obliga a leerlo entero antes (read-before-write);
// con la ventana de `leer` lo reescribiría solo con lo que vio y perdería el resto.
const MAX_REESCRIBIR = 20_000;

/** write_file que solo crea archivos nuevos o reescribe pequeños (< 20 KB). */
export const escribir = defineTool({
  ...writeFile,
  description:
    "Escribe un archivo completo en el sandbox. Solo para archivos NUEVOS o pequeños (< 20 KB). No reescribe archivos " +
    "grandes existentes (spec/especificacion.md, docs/api/msg.md, openapi.yaml…): quien tiene bash los edita por " +
    "rangos (python3); quien no, escribe su propio archivo nuevo. Nunca experimentos.jsonl.",
  async execute(input, ctx) {
    if (PROHIBIDO.test(input.filePath)) throw new Error("experimentos.jsonl solo lo escribe probe.py");
    const tam = await caja.tamano(ctx, input.filePath);
    if (tam > MAX_REESCRIBIR) {
      throw new Error(`${input.filePath} tiene ${tam} bytes: no se reescribe entero. Edítalo por rangos o escribe un archivo nuevo.`);
    }
    return final(writeFile.execute(input, ctx));
  },
});
