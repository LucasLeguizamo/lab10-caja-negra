// Los 20 ejemplos del material, en orden y con estado desde /__reset. El material es de la versión de la mañana; si
// tools/version_vigente.json marca una versión posterior, se usan las respuestas del último s-canario-* de esa versión
// (los mismos 20 mensajes, grabados contra el original vigente con tools/canary.py).
import { existsSync, readFileSync } from "node:fs";

import { test } from "e2e";

import { seq } from "./caja";

type Paso = { request: { m: string } | null; status: number; response: unknown };
type Fila = Paso & { id: number; seq: string; path?: string };

const leer = <T>(ruta: string): T[] =>
  readFileSync(new URL(ruta, import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const vf = new URL("../tools/version_vigente.json", import.meta.url);
const desde: number = existsSync(vf) ? JSON.parse(readFileSync(vf, "utf8")).desde_id : 0;

function pasos(): { origen: string; filas: Paso[] } {
  if (!desde) return { origen: "material", filas: leer<Paso>("../material/pruebas/ejemplos.jsonl") };
  const log = leer<Fila>("../experimentos.jsonl");
  const canario = log.filter((f) => f.seq.startsWith("s-canario-") && f.id >= desde).at(-1)?.seq;
  if (!canario) throw new Error(`no hay s-canario-* desde el id ${desde}: corre tools/canary.py`);
  return { origen: canario, filas: log.filter((f) => f.seq === canario && f.path !== "/__reset" && f.request) };
}

const { origen, filas } = pasos();

test(`los 20 ejemplos del material, en orden y con estado (${origen})`, async () => {
  await seq(filas.map((e) => [(e.request as { m: string }).m, e.status, e.response] as const));
});
