// Misión cmd-halt: (1) HALT existe con aridad 1, solo confirma con el arg exactamente "1" (409 E520 en otro caso)
// y deja el servicio detenido: toda POST /msg autenticada pasa a 503 E599 hasta un POST /__reset con token;
// (2) el catálogo de sugerencias de E301 suma HALT (desempate alfabético). Cada valor esperado está copiado del log
// (ids 1638-1671, corroborado con los viejos citados); cada test arranca de /__reset, como el evaluador.
//
// Comparación como el evaluador (parity-verifier: status + cuerpo; JSON sin orden de claves; texto exacto si no es
// JSON): por eso los cuerpos van como objeto (err()), no como la cadena con espacios del log. Donde el informe dice
// que el orden importa (`sugerencia` es el ÚLTIMO campo, ids 1652-1663) se comprueba además sobre el texto crudo,
// tolerando los espacios del original.
import { expect, test } from "e2e";

import { err, igual, msg, pedir, reset, seq, type Respuesta } from "./caja";

const ARIDAD = err("E302", "aridad inválida");
const CONTROL_MAL_FORMADO = err("E201", "control mal formado");
const CONTROL_INVALIDO = err("E202", "control inválido");
// ids 910, 1133, 1226, 1393-1404, 1643-1645.
const E520 = err("E520", "operación destructiva: detiene el servicio; reenvía con confirmación");
// ids 1284, 1285, 1303-1314, 1646-1650.
const E599 = err("E599", "service halted");
// El mensaje de E301 TERMINA EN ESPACIO (ids 1631, 1652, 1653).
const E301 = err("E301", "comando desconocido ");
const sug = (cmd: string) => err("E301", "comando desconocido ", { sugerencia: cmd });
const E506 = err("E506", "límite excedido");
const E510 = err("E510", "cuenta bloqueada", { intentos: 1 });
const E001 = err("E001", "no autorizado");
const ALTA_OK = (cuentaId: string) => ({ cuentaId });

/** `sugerencia` es el último campo del cuerpo (regex tolerante a los espacios del log). */
const sugerenciaUltima = (r: Respuesta, cmd: string) =>
  expect(r.texto).toMatch(new RegExp(`"sugerencia":\\s?"${cmd}"\\}\\s*$`));

test("HALT existe con aridad 1: 0 args y 2 args dan E302 (ids 1639, 1640; viejos 1227, 1413, 1414)", async () => {
  await seq([
    ["HALT;71", 400, ARIDAD], // 0 args, control 71 válido
    ["HALT;0;1;14", 400, ARIDAD],
    ["HALT;1;1;81", 400, ARIDAD],
  ]);
});

test("HALT valida forma/control antes de E520: E202/E201 (ids 1641, 1642; viejos 1411, 1412, 1415)", async () => {
  await seq([
    ["HALT;0;00", 400, CONTROL_INVALIDO],
    ["HALT;0;XX", 400, CONTROL_MAL_FORMADO],
    ["HALT;1;00", 400, CONTROL_INVALIDO],
  ]);
});

test("HALT solo confirma con el arg exactamente \"1\": el resto da 409 E520 sin efecto (ids 1643-1645; viejos 910, 1133, 1226, 1393-1404)", async () => {
  await seq([
    ["HALT;0;22", 409, E520],
    ["HALT;X;42", 409, E520],
    ["HALT;si;49", 409, E520],
    ["HALT;00;17", 409, E520],
    ["HALT;2;16", 409, E520],
    ["HALT;true;81", 409, E520],
    ["HALT;yes;69", 409, E520],
    ["HALT; 1;19", 409, E520], // espacio delante: no es "1" exacto
    ["HALT;1 ;19", 409, E520], // espacio detrás: no es "1" exacto
    ["HALT;A;19", 409, E520],
    ["HALT;-1;19", 409, E520],
  ]);
});

test("HALT;1 da 503 E599 y el nombre se pliega solo a mayúsculas ASCII (id 1646; viejos 1284, 1303, 1405)", async () => {
  await seq([["HALT;1;19", 503, E599]]);
  await seq([["halt;1;19", 503, E599]]);
});

test("detenido, toda POST /msg autenticada da 503 E599 antes de aridad/control/E301/PING y del cuerpo (ids 1647-1650; viejos 1285, 1306-1312, 1323-1325)", async () => {
  await seq([
    ["HALT;1;19", 503, E599],
    ["CONSULTA;AC-0001;14", 503, E599],
    ["PING;64", 503, E599],
    ["PING;64;64", 503, E599], // aridad inválida en estado sano
    ["FOO;47", 503, E599], // comando desconocido
    ["ALTA;Beto;00", 503, E599], // control inválido
    ["HALT;71", 503, E599], // aridad inválida
    ["HALT;0;22", 503, E599], // ni siquiera re-evalúa la confirmación
  ]);
  // Cuerpo: JSON roto, sin m, no objeto y >8192 bytes también dan E599 (viejos 1323-1325).
  for (const body of ["{", "5", JSON.stringify({ x: 1 }), "x".repeat(9000)]) {
    igual(await pedir("POST", "/msg", { body }), 503, E599);
  }
});

test("POST /__reset con token revive el servicio detenido (id 1651; viejos 1328, 1330)", async () => {
  igual(await reset(), 200, { ok: true });
  igual(await msg("HALT;1;19"), 503, E599);
  igual(await reset(), 200, { ok: true });
  igual(await msg("PING;64"), 200, { pong: true });
  igual(await msg("HALT;1;19"), 503, E599); // viejo 1329: se puede volver a detener
  igual(await reset(), 200, { ok: true });
  igual(await msg("PING;64"), 200, { pong: true }); // viejo 1330
});

test("POST /__reset sin Authorization da 401 E001 y NO revive (viejo 1326)", async () => {
  igual(await reset(), 200, { ok: true });
  igual(await msg("HALT;1;19"), 503, E599);
  igual(await pedir("POST", "/__reset", { auth: null }), 401, E001);
  igual(await msg("PING;64"), 503, E599); // viejo 1327: sigue detenido
  igual(await reset(), 200, { ok: true });
});

test("E520 no detiene el servicio: tras HALT;0;22 un TRANSFER sigue dando E506 (ids 1669 -> 1670)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, ALTA_OK("AC-0001")],
    ["ALTA;Beto;11", 201, ALTA_OK("AC-0002")],
    ["TRANSFER;AC-0001;AC-0002;60000;32", 422, E506],
    ["HALT;0;22", 409, E520],
    ["TRANSFER;AC-0001;AC-0002;60000;32", 422, E506], // 1670: no E599
  ]);
});

test("E520 no cuenta para el contador E510: 2×E506 + E520 + 2×E506 -> E510 intentos=1 (ids 1667-1671)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, ALTA_OK("AC-0001")],
    ["ALTA;Beto;11", 201, ALTA_OK("AC-0002")],
    ["TRANSFER;AC-0001;AC-0002;60000;32", 422, E506], // 1667
    ["TRANSFER;AC-0001;AC-0002;60000;32", 422, E506], // 1668
    ["HALT;0;22", 409, E520], // 1669: no suma intento
    ["TRANSFER;AC-0001;AC-0002;60000;32", 422, E506], // 1670: 3er E506, no bloqueo
    ["TRANSFER;AC-0001;AC-0002;60000;32", 423, E510], // 1671: 4º rechazo -> intentos 1
  ]);
});

test("E301 sugiere HALT a distancia <=1 (ids 1652, 1654-1656; viejos 1016, 1529, 1631)", async () => {
  igual(await reset(), 200, { ok: true });
  for (const m of ["HELP;X;45", "HAL;X;59", "HALTX;X;52", "HALTO;X;36"]) {
    const r = await msg(m);
    igual(r, 400, sug("HALT"));
    sugerenciaUltima(r, "HALT");
  }
});

test("E301 sugiere por distancia de edición <=2: CONSULT, ANUL, PINGX, DEPOSIT (ids 1657-1660)", async () => {
  igual(await reset(), 200, { ok: true });
  for (const [m, cmd] of [
    ["CONSULT;X;59", "CONSULTA"],
    ["ANUL;X;11", "ANULA"],
    ["PINGX;X;86", "PING"],
    ["DEPOSIT;X;95", "DEPOSITO"],
  ] as const) {
    const r = await msg(m);
    igual(r, 400, sug(cmd));
    sugerenciaUltima(r, cmd);
  }
});

test("E301 sin candidato a d<=2 NO lleva el campo sugerencia (ids 1653, 1661, 1662)", async () => {
  igual(await reset(), 200, { ok: true });
  for (const m of ["X;X;4", "RETIRO;X;78", "ZZZ;X;88"]) igual(await msg(m), 400, E301);
});

test("empate E301 a igual distancia: ALNG (d=2 de ALTA y PING) sugiere ALTA, orden alfabético (id 1663; viejo 471)", async () => {
  igual(await reset(), 200, { ok: true });
  const r = await msg("ALNG;X;85");
  igual(r, 400, sug("ALTA"));
  sugerenciaUltima(r, "ALTA");
});

// DESCONOCIDO en el informe: no sondeable o no medido; no se afirma nada.
test.skip("DESCONOCIDO: ¿E599 gana a la auth (E001) en POST /msg detenido? (no sondeable: sondear manda token)", async () => {
  // El informe solo observó /__reset sin auth (E001, no revive); falta POST /msg sin Authorization detenido.
});

test.skip("DESCONOCIDO: ¿el servicio se recupera solo con el tiempo sin /__reset?", async () => {
  // Solo se probó /__reset (viejo 1328); no se esperó a que pasara tiempo.
});

test.skip("DESCONOCIDO: ¿HALT;1 (estado E599) cuenta para el contador E510?", async () => {
  // Tras el halt no hay comandos útiles; inobservable.
});

test.skip("DESCONOCIDO: empates de sugerencia que impliquen HALT y NOTAS", async () => {
  // El caso decisivo ALNG->ALTA (id 1663) ya fija el desempate alfabético; los empates HALT+NOTAS no se sondearon.
});
