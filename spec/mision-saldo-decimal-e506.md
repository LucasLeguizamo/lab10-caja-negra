# Misión `saldo-decimal-e506` — saldo decimal + tope E506 en TRANSFER

Rama `mision/saldo-decimal-e506-20261011-1451`. Alcance: el cambio de comportamiento que rompe los 10 diffs del
canario del 14:51 (`s-canario-1451`, ids 1484-1504). **Fuera de alcance**: HALT (1529) y ANULA/E402 como cambio
propio (otra misión); aquí solo se cita el corrimiento en cascada.

Fuentes: log (ids citados), `lib/service.ts` (port vigente) y sondeos propios `m-saldo-fmt-decimal` (1536-1547),
`m-e506-limite-precedencia` (1548-1560), `m-e506-no-acumula` (1561-1568).

---

## Tabla de preguntas

| Q | Pregunta | Estado | ids | Falta |
|---|---|---|---|---|
| Q1 | ¿El `saldo` de CONSULTA es siempre string con exactamente 2 decimales y valor = centavos/100, sin separador de miles, con `-` si es negativo y `0.00` (no `-0.00`) para 0? | Observado | 813, 816, 819, 827, 833, 844, 846, 869, 1084, 1107, 1181, 1204, 1261, 1262, 1424, 1425, 1427, 1489, 1492, 1495, 1503, 1540, 1542, 1544, 1545, 1547, 1567, 1568 | — |
| Q2 | ¿Hay algún otro campo numérico afectado en `/msg`? | Observado | éxitos: 1490, 1491, 1502, 1556, 1565 (`status`/`operacionId` son string); E510 `intentos` es entero de conteo (842, 843, 1353) | Ningún otro campo monetario aparece en los cuerpos observados |
| Q3 | ¿Afecta el cambio a la aritmética interna (el importe sumado/restado sigue siendo el entero del request, sin reescalar)? | Observado | 832→833, 868→869, 1543→1544, 1544/1543→1545, 1546→1547, 1565/1566→1567, 1568 | La parte de ANULA/DEVOLUCION no se probó (fuera de alcance) |
| Q4 | Umbral exacto de E506 en TRANSFER | Observado (50000 inclusive pasa, 50001 falla) | pasa: 838, 1491, 1500 (50000 llega a E507), 1556; falla: 839, 840, 841, 795, 796, 817, 1129, 1350, 1471, 1472, 1493, 1494, 1557 | — |
| Q5 | ¿Es tope por operación y no acumulado por cuenta? | Observado | 1565, 1566 (dos de 30000, suma 60000, ambas 200) | — |
| Q6 | ¿Aplica también a DEPOSITO? | Observado (no) | 832 (9999999999→200), 1490 (250000→200), 1502 (700→200) | Cap superior del monto en DEPOSITO (10000000000) citado en el port (205-210, 226) no re-sondeado |
| Q7 | ¿Código, status y mensaje byte a byte de E506? | Observado | 1471, 1493, 1494, 1557 (y 795, 839, 1129): `422 {"error": "E506", "mensaje": "límite excedido"}` | — |
| Q8 | Precedencia de E506 frente a vecinos | Observado | E202>E302>E303>E304>E401>E510>E506>E507: 1560; 1558/1559; 1554/1555/867; 1552; 1553; 842; 1350/1352/1557 vs 1500 | E506 frente a auth (E001) no aislado: la auth es capa HTTP previa |
| Q9 | ¿La exención del tope por homónimos es igualdad exacta de nombre? | Observado | 1388 (Ana→Ana, 50001, 200); 1389 (ANA), 1390 (`Ana `), 1391 (Bob) → 422 E506 | Normalización NFC/NFD/plegados no aislada |
| Q10 | ¿Cambió control/aridad de TRANSFER? | Observado (no) | 1558 (1 arg → E302), 1559 (4 args → E302), 1560 (control 58 → E202), 3 args → 200: 1556, 1565 | — |
| Q11 | ¿Qué diffs del canario son cambio propio y cuáles corrimiento? | Observado | propios: 1471/1494 (E506), 1493; formato: 1489, 1492, 1495, 1503; cascada: 1473, 1497, 1498, 1502 (secuencia 1484-1504: 1490 OP-0001, 1491 OP-0002, 1493/1494 sin crear OP-0003, 1502 OP-0003, 1497/1498 ANULA OP-0003 → E402) | — |

---

## Tabla de reglas

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| R1 | `saldo` de CONSULTA: status 200, cuerpo `{"cuenta_id": "<arg0 tal cual>", "saldo": "<string>"}`; string con exactamente 2 decimales, valor = centavos/100, sin separador de miles, `-` si negativo, 0 → `"0.00"`. Muestras: 0→`"0.00"` (813, 1427, 1489); 7→`"0.07"` (1542); 1→`"0.01"` (1425); -1→`"-0.01"` (1424); 500→`"5.00"` (1107); 10000→`"100.00"` (1084); 12345→`"123.45"` (1540); 12246→`"122.46"` (1544); 40000→`"400.00"` (816, 1492); 40700→`"407.00"` (827, 1503); 50000→`"500.00"` (844); 50001→`"500.01"` (846); 60000→`"600.00"` (1568); 210000→`"2100.00"` (819, 1495); 9999999999→`"99999999.99"` (833); 10000000099→`"100000000.99"` (869); 9999939999→`"99999399.99"` (1567); negativos -5→`"-0.05"` (1181), -990→`"-9.90"` (1204), -19999999998→`"-199999999.98"` (1261, 1262). | log (ids arriba) | Alta (muchas muestras, incluye 0, 1, 7, 12345, grandes y negativos) |
| R2 | `saldo` es el único campo numérico de `/msg`; los éxitos son `{"status": "recieved", "operacionId": "OP-000N"}` (1490, 1491, 1502, 1556, 1565) y E510 añade `intentos` entero de conteo (842, 843, 1353). | log | Alta |
| R3 | La aritmética interna no se reescala: el monto del request se suma/resta 1:1 (unidad = centavo de la salida). 9999999999 → 200 y saldo `"99999999.99"` (832→833); +100 → `"100000000.99"` (868→869); 12345-99=12246 → `"122.46"` (1543→1544); 7+99=106 → `"1.06"` (1543→1545); +100=206 → `"2.06"` (1546→1547); dos de 30000: 9999999999-60000=9999939999 → `"99999399.99"` (1565/1566→1567). El cambio es de serialización, no de escala. | log | Alta |
| R4 | E506 en TRANSFER: `monto > 50000` (estricto) → **422** `{"error": "E506", "mensaje": "límite excedido"}` (`í` acentuada). 50000 pasa: 838 (200 OP-0002), 1500 (50000 → E507, no tope), 1556 (200); 50001 falla: 839, 1129, 1350, 1557; también 60000 (841), 75000 (840), 100000 (795, 1471, 1494), 100001 (796, 1472), 120000 (817, 1493). | log | Alta |
| R5 | El tope es **por operación**, no acumulado: dos TRANSFER de 30000 (suma 60000) → 200 y 200 (1565, 1566; saldos 1567, 1568). | log | Alta |
| R6 | El tope **no** aplica a DEPOSITO: 9999999999 → 200 (832), 250000 → 200 (1490), 700 → 200 (1502). | log | Alta |
| R7 | Exención: si origen y destino tienen el **mismo string exacto** de nombre dado en ALTA, E506 no aplica; `50001` Ana→Ana → 200 OP-0002 (1388); Ana→`ANA` (1389), Ana→`Ana ` con espacio final (1390) y Ana→Bob (1391) → 422 E506. Sin normalizar. | log (1388-1391) | Media-alta (solo igualdad exacta probada) |
| R8 | Precedencia en TRANSFER: control **E202** > aridad **E302** > **E303** > **E304** > **E401** > **E510** (bloqueo) > **E506** > **E507**. Evidencia: E202 (1560, control 58 con valor correcto 59), E302 (1558 con 1 arg, 1559 con 4), E303 con monto > tope (`10000000000` 1554; `500.5` 1555; `0` 867), E304 (1552, 60000 con origen==destino), E401 (1553, AC-0009 con 60000), E510 antes que E506 (842, 60000 tras 3 fallos), E506 antes que E507 (1350, 1352, 1557 con 50001 vs 1500, 1556 con 50000). | log | Alta |
| R9 | El rechazo E506 suma al contador de bloqueo E510 del origen (E506 y E507 comparten contador): 3 fallos mixtos → siguiente intento 423 E510 `intentos:1` (1350-1353, 842, 1111-1114, 1187-1191). Detalle E510 = otra misión. | log | Alta |
| R10 | TRANSFER sin cambios de forma: aridad **3** (E302 con 1 y 4 args: 1558, 1559), control sobre `m` sin el último segmento (E202 con control erróneo: 1560), éxito `200 {"status": "recieved", "operacionId": "OP-000N"}` (1556, 1565). | log | Alta |
| R11 | Cascada del canario: el contador OP solo avanza en éxito. 1490 DEPOSITO 250000 → OP-0001; 1491 TRANSFER 40000 → OP-0002; 1493/1494 rechazados por E506 (no crean OP-0003); 1502 DEPOSITO 700 → OP-0003 (la referencia esperaba OP-0004); 1497/1498 `ANULA;OP-0003` → 404 E402 porque OP-0003 ya no existe. Por eso 1473, 1497, 1498 y 1502 son corrimiento, no cambio propio. | log (1484-1504) | Alta |
| R12 | Formatos de monto: `parseMonto` = 1..10 dígitos ASCII, sin ceros a la izquierda; no se aceptan decimales (`500.5` → E303, 1555) ni 11 dígitos (`10000000000` → E303, 1554); `0` → E303 (867). No hay redondeo de entrada que probar. | log (+ ids previos 162-182, 205-210, 226 citados en el port) | Alta para 500.5/11 dígitos/0; media para el resto de formatos raros (evidencia previa) |

---

## Inferido

- **Modelo**: el original guarda saldos e importes como enteros de "centavos" y el cambio es **solo de capa de
  salida**: `saldo = signo + floor(|c|/100) + "." + pad2(|c|%100)` (sin `toFixed`, sin separadores, sin `-0.00`,
  ids 1424-1427). Toda la aritmética (suma/resta, contadores AC/OP) sigue en la misma unidad entera de antes; de ahí
  que `DEPOSITO;9999999999` siga dando 200 (832) y el saldo salga `"99999999.99"` (833).
- **E506** es una guarda nueva de TRANSFER equivalente a `if (monto > 50000 && nombre(origen) !== nombre(destino))
  → 422 E506`, situada tras control/aridad/E303/E304/E401/bloqueo E510 y antes de E507, y que suma al contador de
  fallos del origen. Umbral 50000 estricto (838 vs 839, 1556 vs 1557), solo TRANSFER (832, 1490, 1502), exenta por
  homónimos exactos (1388-1391), por operación y no acumulada (1565, 1566).
- **Por qué el canario falla**: la referencia esperaba el tope viejo de 100000 y saldos enteros; el original ha
  bajado el tope a 50000 y cambiado el formato, y el fallo de los TRANSFER de 100000/120000 desplaza la numeración
  OP de todo lo posterior (incluidos ANULA/E402 y el DEPOSITO `OP-0003`), produciendo 1473, 1497, 1498 y 1502.
- **No distinguible observacionalmente** si hay almacenamiento en centavos frente a solo formateo en la respuesta:
  ambas hipótesis son equivalentes con la evidencia; se adopta la de "centavos enteros, formateo de salida".

## Desconocido

- Normalización exacta de la igualdad de nombres para la exención (solo string exacto probado: 1388-1391); NFC/NFD
  o plegados de mayúsculas no aislados.
- Cap superior del monto en DEPOSITO: `10000000000` rechazado según el port (ids 205-210, 226); no re-sondeado
  (no está en los diffs).
- Formatos de monto raros (`+100`, `0100`, `1e3`, `1_000`, dígitos no ASCII): evidencia previa del log/port dice
  E303; hoy solo se comprobó `500.5` (1555) y 11 dígitos (1554).
- E506 frente a la capa de auth (E001 sin token / token inválido): no aislado; la auth es HTTP previa y global.
- ANULA/DEVOLUCION como cambio propio (restauración del importe, E402), HALT/E520/E599 y detalles de E510
  (desbloqueo, `intentos` máximo): fuera de alcance (otra misión); solo se citan para la precedencia y la cascada
  (842, 1497, 1498, 1350-1353).
