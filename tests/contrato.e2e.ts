// Contrato de material/README.md: /health, /__reset, auth y rutas inexistentes. Cada valor sale del log (ids).
import { test } from "e2e";

import { err, igual, msg, pedir, reset } from "./caja";

const E001 = err("E001", "no autorizado");
const E404 = err("E404", "ruta desconocida");

test("GET /health con token responde ok (ids 2, 27)", async () => {
  igual(await pedir("GET", "/health"), 200, { ok: true });
});

test("POST /__reset responde ok (id 3)", async () => {
  igual(await reset(), 200, { ok: true });
});

test("sin token, /health y /msg dan 401 E001 (ids 1, 37)", async () => {
  igual(await pedir("GET", "/health", { auth: null }), 401, E001);
  igual(await pedir("POST", "/msg", { auth: null, body: JSON.stringify({ m: "PING;64" }) }), 401, E001);
});

test("Basic, bearer en minúscula y token inválido dan 401 E001 (ids 101, 102, 96, 100)", async () => {
  const body = JSON.stringify({ m: "PING;64" });
  for (const auth of ["Basic xxx-invalid-token-123", "bearer xxx-invalid-token-123", "Bearer otro-token"]) {
    igual(await pedir("POST", "/msg", { auth, body }), 401, E001);
  }
});

test("ruta inexistente da 404 E404 antes que auth: sin token y con token inválido (ids 29, 103)", async () => {
  igual(await pedir("GET", "/nada", { auth: null }), 404, E404);
  igual(await pedir("GET", "/nada", { auth: "Bearer xxx-invalid-token-123" }), 404, E404);
});

test("PING responde pong (ejemplo 1)", async () => {
  igual(await reset(), 200, { ok: true });
  igual(await msg("PING;64"), 200, { pong: true });
});
