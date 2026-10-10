// Los 20 ejemplos de material/pruebas/ejemplos.jsonl (versión de la mañana): una sola seq con estado desde /__reset.
import { readFileSync } from "node:fs";

import { test } from "e2e";

import { seq } from "./caja";

type Ejemplo = { n: number; request: { m: string }; status: number; response: unknown };

const ejemplos: Ejemplo[] = readFileSync(new URL("../material/pruebas/ejemplos.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

test("los 20 ejemplos del material, en orden y con estado", async () => {
  await seq(ejemplos.map((e) => [e.request.m, e.status, e.response] as const));
});
