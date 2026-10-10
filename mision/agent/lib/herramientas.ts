// Definiciones compartidas: los subagentes declarados no heredan tools del root, así que cada uno re-exporta las suyas.
import { defineState } from "eve/context";
import { defineTool } from "eve/tools";
import { z } from "zod";

import * as caja from "./caja";

// ponytail: tope por sesión, no por día. 8.000 req/día por token: vigía ~1.500/día + una misión <= 400 queda lejos.
const TOPE_MENSAJES = 400;
const gasto = defineState("mision.gasto", () => ({ mensajes: 0 }));

export const sondear = defineTool({
  description:
    "Manda una seq al servicio ORIGINAL vía tools/probe.py: hace /__reset y luego cada mensaje por POST /msg. " +
    "Todo queda registrado en experimentos.jsonl con id. Agrupa por hipótesis; no repitas una seq ya registrada. " +
    "Cada mensaje es 'CMD;arg;...;control' con el control bien calculado (si no, E202 tapa todo).",
  inputSchema: z.object({
    seq: z.string().regex(/^m-[a-z0-9-]{3,60}$/, "nombre único que empiece por m- (misión)"),
    hipotesis: z.string().min(10),
    mensajes: z.array(z.string()).min(1).max(40),
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
    "Fija los tests de la misión: commit de tests/ en la rama. Desde aquí la compuerta rechaza cualquier cambio en " +
    "tests/. Llamar UNA vez, cuando los tests están escritos y fallan por la razón esperada (el comando aún no existe).",
  inputSchema: z.object({ resumen: z.string().min(10).max(60) }),
  execute: ({ resumen }, ctx) => caja.fijarTests(ctx, resumen),
});
