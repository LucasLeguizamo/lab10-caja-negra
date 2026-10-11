# Misión `cmd-halt` — HALT + sugerencia de E301

Rama `mision/cmd-halt-20261011-1528`, apilada sobre `mision/saldo-decimal-e506-20261011-1451`.
Versión vigente = la de saldo decimal (`tools/version_vigente.json` `desde_id`=791); todas las filas citadas ≥791 son de esa versión.
Filas nuevas de esta misión: **1638–1671**. Filas viejas de HALT/`E599`/sugerencia citadas como corroboración: 471, 910, 1016, 1025, 1030, 1133, 1226, 1227, 1284, 1285, 1303–1314, 1323–1332, 1393–1415, 1439–1441, 1529, 1631.
Convención de campos: el JSON de error lleva `"error"` y luego `"mensaje"`; el E301 con candidato añade `"sugerencia"` **al final**. El `mensaje` de E301 termina en **espacio** (`"comando desconocido "`).

## Preguntas

| Q | Pregunta | Estado | ids | Falta |
|---|----------|--------|-----|-------|
| Q1 | ¿Existe HALT y con qué aridad? | Observado: existe, aridad 1 | 1639, 1640 (nuevos); 1227, 1413, 1414 (viejos) | — |
| Q2 | ¿HALT sin arg y con 2 args? | Observado: `400 E302` | 1639, 1640 | — |
| Q3 | ¿Valida control/forma antes que E520? | Observado: sí (E202/E201 y E302 antes) | 1641, 1642 (nuevos); 1411, 1412, 1415 (viejos) | — |
| Q4 | ¿Sin el literal `"1"` da 409 E520? Mensaje exacto | Observado | 1643, 1644, 1645 (nuevos); 910, 1133, 1226, 1393–1404 (viejos) | — |
| Q5 | ¿`HALT;1` da 503 E599? Mensaje exacto | Observado | 1646 (nuevo); 1284, 1303 (viejos) | — |
| Q6 | Tras halt, ¿qué responde cualquier otro comando? | Observado: todo 503 E599 | 1647–1650 (nuevos); 1285, 1304–1312, 1323–1325 (viejos) | — |
| Q7 | ¿`/__reset` repara el servicio? | Observado: sí, 200 `{"ok":true}` | 1651 (nuevo); 1328, 1330 (viejos) | — |
| Q8 | ¿`/__reset` sin auth repara? | Observado: no, 401 E001 y sigue detenido | 1326 (viejo) | — |
| Q9 | ¿E599 gana a control/aridad/E301/PING? | Observado: sí, compuerta global | 1649, 1650 (nuevos); 1306–1312, 1323–1325 (viejos) | — |
| Q10 | ¿E599 gana a auth (E001)? | Desconocido | 1326 (solo reset, no /msg) | Falta POST /msg sin auth estando detenido; no sondeable con `sondear` (siempre token de equipo) |
| Q11 | ¿E520 frente a E301/E202? | Observado: E201/E202/E302 antes; E301 no compite (distinto comando) | 1641, 1642 (nuevos) | — |
| Q12 | ¿El intento E520 cuenta para E510? | Observado: no cuenta | 1667–1671 (nuevos) | — |
| Q13 | ¿El estado E599 cuenta para E510? | Desconocido | — | Tras el halt no hay comandos útiles; no medible |
| Q14 | ¿HALT cambia el estado de las cuentas o solo la disponibilidad? | Inferido: solo disponibilidad (flag de servicio) | 1669, 1670 (nuevos) | Efecto sobre cuentas/saldos inobservable (detenido todo da E599; `/__reset` borra) |
| Q15 | ¿Se recupera solo con el tiempo? | Desconocido | 1328 (solo reset) | No se esperó; solo probado `/__reset` |
| Q16 | ¿Cambia el conjunto de sugerencias de E301? | Observado: suma HALT (y NOTAS) | 1652, 1654–1656 (nuevos); 1016, 1025, 1030, 1529, 1631 (viejos) | — |
| Q17 | ¿Desempate por alfabético o por orden del catálogo? | Observado: alfabético | 1663 (nuevo); 471, 1439, 1440 (viejos) | — |
| Q18 | ¿Falta el campo cuando no hay candidato? | Observado: sí (`X`, `RETIRO`, `ZZZ`) | 1653, 1661, 1662 (nuevos) | — |
| Q19 | ¿HALT es case-insensitive? | Observado: sí | 1405 (viejo) | — |

## Reglas

| ID | Comportamiento | Evidencia | Confianza |
|----|----------------|-----------|-----------|
| R1 | HALT existe en el catálogo, aridad 1, control normal. `HALT;71` (0 args, control 71 válido) → `400 {"error":"E302","mensaje":"aridad inválida"}` | 1639 (nuevo); 1227 (viejo) | Alta |
| R2 | HALT con 2 args → `400 {"error":"E302","mensaje":"aridad inválida"}` | 1640 (nuevo); 1413, 1414 (viejos) | Alta |
| R3 | Precedencia E201/E202/E302 > E520: `HALT;0;00` → `400 E202 "control inválido"`; `HALT;0;XX` → `400 E201 "control mal formado"`; aridad → E302 | 1641, 1642 (nuevos); 1411, 1412, 1415 (viejos) | Alta |
| R4 | Confirmación = arg exactamente `"1"`. Cualquier otro (`0`, `X`, `si`, `00`, `2`, `true`, `yes`, `01`, `11`, `10`, `confirm`, `A`, `-1`, `" 1"`, `"1 "`) → `409 {"error":"E520","mensaje":"operación destructiva: detiene el servicio; reenvía con confirmación"}`, sin efecto | 1643, 1644, 1645 (nuevos); 910, 1133, 1226, 1393–1404 (viejos) | Alta |
| R5 | `HALT;1` → `503 {"error":"E599","mensaje":"service halted"}` y deja el servicio detenido | 1646 (nuevo); 1284, 1303 (viejos) | Alta |
| R6 | Detenido, **toda** POST /msg autenticada → `503 {"error":"E599","mensaje":"service halted"}`, antes de aridad, control (E201/E202), E301, PING y del parseo/límites del cuerpo (E100/E101/E102) | 1647, 1648, 1649, 1650 (nuevos); 1285, 1306–1312, 1323–1325 (viejos) | Alta |
| R7 | `POST /__reset` (con token) → `200 {"ok":true}` y revive el servicio | 1651 (nuevo); 1328, 1330 (viejos) | Alta |
| R8 | `POST /__reset` sin Authorization → `401 {"error":"E001","mensaje":"no autorizado"}` y **no** revive | 1326 (viejo) | Alta |
| R9 | E520 no detiene el servicio (el siguiente comando responde normal) | 1669 → 1670 (nuevos) | Alta |
| R10 | E520 **no** cuenta para el contador E510: 2×E506 + E520 + E506 → E506, y el 4º rechazo → `423 {"error":"E510","mensaje":"cuenta bloqueada","intentos":1}` | 1667, 1668, 1669, 1670, 1671 (nuevos) | Alta |
| R11 | El conjunto de sugerencias de E301 incluye HALT: `HELP;X;45` → `400 {"error":"E301","mensaje":"comando desconocido ","sugerencia":"HALT"}`; `HAL`/`HALTX`/`HALTO` (d=1) → HALT | 1652, 1654, 1655, 1656 (nuevos); 1016, 1529, 1631 (viejos) | Alta |
| R12 | Sugerencia por distancia de edición ≤2: `CONSULT`→CONSULTA, `ANUL`→ANULA, `PINGX`→PING, `DEPOSIT`→DEPOSITO | 1657, 1658, 1659, 1660 (nuevos) | Alta |
| R13 | Sin candidato a d≤2 el campo `sugerencia` **no aparece**: `400 {"error":"E301","mensaje":"comando desconocido "}` | 1653, 1661, 1662 (nuevos) | Alta |
| R14 | Empate a igual distancia → **orden alfabético** (no orden de inserción del catálogo): `ALNG` (d=2 de ALTA y de PING) → `"sugerencia":"ALTA"` | 1663 (nuevo); 471, 1439, 1440 (viejos) | Alta |
| R15 | El nombre de comando se pliega a mayúsculas solo ASCII: `halt;1;19` → E599 | 1405 (viejo) | Media (viejo, no re-sondeado) |
| R16 | HALT solo conmuta un flag de servicio: no consume AC-/OP- ni altera el contador E510 (el conteo evoluciona exactamente por los E506) | 1667–1671 (nuevos) | Media |

## Inferido
- **Auth (E001) precede a la compuerta E599** (pipeline ruta → auth → msg): `sondear` manda siempre el token de equipo, así que no se pudo observar un POST /msg sin auth estando detenido. Encaja con el viejo 1326 (reset sin auth → E001 y no revive). Confianza media.
- **HALT no toca cuentas ni saldos**; solo la disponibilidad del servicio. El estado queda inaccesible tras el halt y `/__reset` lo borra, por lo que no hay efecto observable sobre cuentas. Confianza media.
- **E599 persiste hasta `/__reset`** (booleano `halted`); no parece recuperarse solo. Confianza media.

## Desconocido
- **E599 frente a auth**: ¿un `POST /msg` sin/invalid Authorization estando detenido da E001 o E599? No sondeable con `sondear`.
- **Recuperación automática por tiempo**: no se esperó; solo se probó `/__reset`.
- **¿`HALT;1` bloquea/desbloquea cuentas o mueve saldos?** Inobservable (detenido todo da E599; `/__reset` reinicia el estado).
- **¿E599/HALT;1 cuenta para E510?** No medible (tras detener no hay comandos útiles).
- Detalle de empates que impliquen HALT+NOTAS (el caso decisivo ALNG→ALTA ya fija la regla; no cambia tests posibles).

## Nota de reproducción
Todas las filas viejas se reprodujeron hoy: 1631 ≡ 1652 (`HELP;X;45` → sugerencia HALT), y el resto (aridad, E520, E599, compuerta global, `/__reset`, empate alfabético, conjunto de sugerencias) quedó re-confirmado con 1638–1671. No hay contradicciones entre el informe viejo y la versión vigente.
