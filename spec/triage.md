# Triage del log de experimentos

Registros: 150 (ids 1-150). Generado por `tools/analysis/triage.py`; no editar a mano.

## 1. Por seq

| seq | ids | hipotesis | nº registros | conclusiones (id) |
|---|---|---|---|---|
| s0-health | 1-1 | GET /health responde sin token | 1 | (1) sin token, /health responde 401 E001: /health también exige token |
| s1-health-auth | 2-2 | GET /health con token válido responde 200 | 1 | - |
| s-ejemplos-1 | 3-23 | Canario: reproducir 20 ejemplos de la manana y comparar (deriva de version) | 21 | (3) Reset devuelve 200 {ok:true} sin header X-Req. · (4) Canario s-ejemplos-1 (ids 4-23): los 20 ejemplos reproducidos en orden dan status y cuerpo identicos a ejemplos.jsonl (0 diferencias) -> sin deriva detectable vs la manana en esta secuencia. · (23) ALTA;Lucia;Gomez;11 -> 400 E302 identico al ejemplo 20; ultimo de la secuencia canario, sin diferencias. |
| s-xreq-1 | 24-36 | X-Req tras reset: contador por token; PING x2 / GET /health cuenta/lleva X-Req? / PING tras /health: X-Req sigue la cuenta (3 o 4) / ruta inexistente con token: X-Req? / PING tras 404: cuenta? / error de control (E202) cuenta? / PING tras error de control / cuerpo no JSON cuenta? / PING tras cuerpo invalido / GET /msg (metodo no permitido) cuenta? / PING tras GET /msg | 13 | (24) El primer X-Req tras este /__reset fue 21 (la canaria ya habia dado 1..20): /__reset NO reinicia X-Req; el reset no lleva X-Req. · (25) X-Req=21 tras reset: el contador no se reinicia con /__reset. · (27) GET /health -> 200 {ok:true} sin X-Req; no cuenta (siguiente /msg=23, sin salto). · (29) Ruta inexistente con token -> 404 E404 'ruta desconocida', sin X-Req y sin contar (siguiente /msg=24). · (31) Error E202 en /msg cuenta en X-Req (25) y lo lleva en el header. · (33) Cuerpo no JSON 'xx' -> 400 E100 'json inválido', con X-Req=27: los errores de cuerpo en /msg tambien cuentan. · (35) GET /msg -> 404 E404 'ruta desconocida' sin X-Req y sin contar (siguiente /msg=29): /msg solo existe para POST. |
| s-xreq-2 | 37-46 | POST /msg sin token: X-Req? error? / POST /msg token invalido / PING: contador intacto tras fallos de auth (esperado 30) / cuerpo sin m cuenta? / m no string / cuerpo vacio / PING tras 3 cuerpos malos (esperado 34 si todos cuentan) / POST /health / GET /__reset / PING tras POST /health y GET /__reset | 10 | (37) POST /msg sin token -> 401 E001 'no autorizado', sin X-Req. · (38) Token invalido -> 401 E001 identico a sin token; sin X-Req. · (39) X-Req=30 tras 2 fallos de auth: los 401 no cuentan. · (40) {} -> 400 E102 'falta m', cuenta (X-Req=31). · (41) m no string (5) -> 400 E102 'falta m', cuenta (32). · (42) Cuerpo vacio -> 400 E100 'json inválido', cuenta (33). · (44) POST /health -> 404 E404 sin X-Req, no cuenta. · (45) GET /__reset -> 404 E404 sin X-Req, no cuenta; /__reset solo POST. · (46) X-Req=35: contador = nº de POST /msg autenticados (cualquier resultado, incl. 400) acumulados, sin reinicio por /__reset; /health, /__reset, 404 y 401 no cuentan ni llevan el header. |
| s-ping-1 | 47-68 | PING es sensible al control? variar solo el control (64 valido en ejemplos) | 22 | (49) PING;00 -> pong: control ignorado por PING. · (53) PING;XX -> pong (control no numerico ignorado). · (54) PING; (control vacio) -> 400 E104 'segmento vacío': el segmento vacio se rechaza antes. · (55) PING;100 (3 digitos) -> pong. · (58) PING;-1 -> pong. · (59) ping;64 minuscula -> pong: nombre del comando insensible a mayusculas. · (61) PING; 64 (espacio en control) -> pong. · (62) PING;64<espacio final> -> pong. · (63) ' PING;64' (espacio inicial) -> 400 E301 'comando desconocido ' con campo extra 'sugerencia':'PING'; el nombre no se recorta. · (64) 'PING' sin ';' -> 400 E103 'falta control'. · (66) PING;; -> E104 segmento vacio. · (67) PING;64;64 -> 400 E302 aridad inválida: PING acepta solo el control como segmento tras el nombre. · (68) PING;1;64 -> 400 E302 aridad inválida. |
| noauth-health-post | 69-69 | POST /health sin token: ¿el método importa para la auth-gate? | 1 | (69) POST /health (método no soportado en esa ruta) da 404 E404 sin token: la combinación ruta+método se resuelve antes de pedir auth |
| noauth-reset | 70-70 | POST /__reset sin token: ¿también exige auth? | 1 | (70) POST /__reset sin token también exige auth (401 E001), igual que /health |
| noauth-msg-valid | 71-71 | POST /msg con cuerpo válido sin token: ¿401 antes de procesar el comando? | 1 | (71) POST /msg con cuerpo válido pero sin token: 401 E001 antes de procesar el comando; el body nunca se evalúa |
| noauth-404-get | 72-72 | GET a ruta inexistente sin token: ¿401 o 404 primero? | 1 | (72) GET a ruta inexistente sin token: 404 E404 'ruta desconocida', no 401: el ruteo no exige auth para rutas que no existen |
| noauth-404-post | 73-73 | POST a ruta inexistente sin token: ¿401 o 404 primero? | 1 | (73) POST a ruta inexistente sin token: mismo 404 E404 que GET, mismo mensaje |
| noauth-root | 74-74 | GET / sin token: ¿qué responde la raíz? | 1 | (74) GET / sin token: 404 E404, la raíz no es una ruta especial |
| noauth-health-slash | 75-75 | GET /health/ con barra final sin token: ¿misma ruta o 404? | 1 | (75) GET /health/ (barra final) sin token: 404 E404, no es la misma ruta que /health: no hay normalización de trailing slash |
| s-sug-1 | 76-88 | campo 'sugerencia' en E301: aparece con espacio inicial; por que no con SALDOS? variar el nombre del comando | 12 | (79) PIN;64 -> E202 control invalido (no E301): el control se valida antes de resolver un comando desconocido, y 64 no es valido para 'PIN'. · (83) ' ALTA;Lucia;82' -> E301 con sugerencia 'ALTA' (control 82 evidentemente aceptado pese al espacio): E301+sugerencia cuando el nombre difiere del conocido solo en espacios. · (85) pinG;64 -> pong: PING insensible a mayusculas (mixto). · (86) SALDO;AC-0001;1 -> E202 (control incorrecto antes de E301). · (87) ';64' (comando vacio) -> 400 E104 segmento vacío. · (88) 'PING ;64' -> E301 con sugerencia 'PING': el espacio dentro del comando no se recorta. |
| noauth-health-upper | 77-77 | GET /HEALTH en mayúsculas sin token: ¿rutas case-sensitive? | 1 | (77) GET /HEALTH (mayúsculas) sin token: 404 E404: el ruteo es case-sensitive, /HEALTH no es /health |
| noauth-msg-put | 89-89 | PUT /msg sin token: ¿ruta+método inválido da 404 antes de auth? | 1 | (89) PUT /msg sin token: 404 E404 igual que ruta inexistente: el método forma parte de la clave de ruteo y se evalúa antes de auth |
| noauth-msg-delete | 90-90 | DELETE /msg sin token | 1 | (90) DELETE /msg sin token: 404 E404, mismo patrón que PUT |
| noauth-msg-patch | 91-91 | PATCH /msg sin token | 1 | (91) PATCH /msg sin token: 404 E404, mismo patrón |
| noauth-msg-options | 92-92 | OPTIONS /msg sin token | 1 | (92) OPTIONS /msg sin token: 404 E404, no hay manejo especial de preflight/OPTIONS |
| noauth-msg-head | 93-93 | HEAD /msg sin token | 1 | (93) HEAD /msg sin token: 404, cuerpo de respuesta vacío (consistente con semántica HEAD, sin cuerpo) |
| noauth-msg-nonjson | 94-94 | POST /msg con cuerpo no-JSON sin token: ¿401 antes de validar el body? | 1 | (94) POST /msg con cuerpo no-JSON y sin token: 401 E001, igual que con cuerpo válido: la auth se evalúa antes de intentar parsear el body |
| auth-bearer-empty-health | 95-95 | GET /health con 'Bearer ' vacío: ¿mismo 401 E001? | 1 | (95) GET /health con 'Authorization: Bearer ' (token vacío): 401 E001, idéntico a header ausente |
| auth-bearer-invalid-health | 96-96 | GET /health con token inventado inválido | 1 | (96) GET /health con token inventado inválido: 401 E001, idéntico a sin token: no se distingue 'falta' de 'inválido' |
| auth-basic-scheme-health | 97-97 | GET /health con esquema Basic en vez de Bearer | 1 | (97) GET /health con esquema 'Basic' en vez de 'Bearer': 401 E001, mismo cuerpo que los demás casos de auth |
| auth-bearer-lowercase-health | 98-98 | GET /health con esquema 'bearer' en minúscula | 1 | (98) GET /health con esquema 'bearer' en minúscula: 401 E001, no hay tratamiento especial por mayúsc/minúsc del esquema |
| auth-bearer-empty-msg | 99-99 | POST /msg con 'Bearer ' vacío y cuerpo válido | 1 | (99) POST /msg con 'Bearer ' vacío y cuerpo válido: 401 E001, mismo patrón que GET /health |
| auth-bearer-invalid-msg | 100-100 | POST /msg con token inventado inválido y cuerpo válido | 1 | (100) POST /msg con token inválido inventado y cuerpo válido: 401 E001, mismo patrón |
| auth-basic-scheme-msg | 101-101 | POST /msg con esquema Basic | 1 | (101) POST /msg con esquema Basic: 401 E001, mismo patrón en esta ruta también |
| auth-bearer-lowercase-msg | 102-102 | POST /msg con esquema 'bearer' minúscula | 1 | (102) POST /msg con esquema 'bearer' minúscula: 401 E001, mismo patrón |
| order-404-invalid-get | 103-103 | GET a ruta inexistente con token inválido: ¿404 o 401 gana? | 1 | (103) GET a ruta inexistente con token inválido: sigue siendo 404 E404, no 401: confirma que el ruteo gana sobre la auth sin importar el token |
| order-404-invalid-post | 104-104 | POST a ruta inexistente con token inválido | 1 | (104) POST a ruta inexistente con token inválido: mismo 404 E404 |
| order-case-invalid | 105-105 | GET /HEALTH mayúsculas con token inválido: ¿404 o 401 gana? | 1 | (105) GET /HEALTH (mayúsculas) con token inválido: 404 E404, no 401: el case-sensitivity del ruteo también gana sobre la auth |
| order-method-invalid | 106-106 | PUT /msg (método inválido) con token inválido: ¿404 o 401 gana? | 1 | (106) PUT /msg con token inválido: 404 E404, no 401: confirma que ruta+método se resuelven antes de la auth incluso con un token presente pero inválido |
| q1a-control-forma-noping | 107-121 | Q1a adaptada: PING ya probado exento de control (log 47-68); forma del campo de control probada con CONSULTA;AC-0001 (control=14, confirmado log#8) que SI valida control | 15 | - |
| q1b-control-borde | 122-128 | C1 (0..96) vs C2 (2..98) vs congruencia mod 97: payloads cuyo control C1 es 0, 1, 2 y sus +97 | 7 | - |
| q2-precedencia | 129-141 | Orden control/comando/aridad/entidad: cada mensaje rompe DOS cosas a la vez | 13 | - |
| q3-token-body-gaps | 142-150 | reset previo a la tanda de cuerpo con token valido / Q3: m vacio con token valido / Q3: m de solo espacios con token valido / Q3: body con clave extra ademas de m, con token valido / Q3: cuerpo JSON array en vez de objeto, con token valido / Q3: m muy largo (ALTA con nombre de 2000 caracteres, control C2 bien formado=71) / Q3: m extremadamente largo (ALTA con nombre de 20000 caracteres, control C2 bien formado=61) / Q3 bisec: acotar el limite de tamano del cuerpo entre 2000(ok) y 20000(413 E101) con 11000 / Q3 bisec2: acotar limite entre 2000(ok) y 11000(413) con 6000 | 9 | - |

## 2. Catalogo de respuestas unicas

Respuestas unicas (status, cuerpo): **31**. Cuerpo JSON con claves ordenadas para comparar; se muestra tal como quedo en el log.

| status | cuerpo | nº | ids | ejemplo de request |
|---|---|---|---|---|
| 200 | `{"ok": true}` | 10 | 2, 3, 24, 27, 47, 76, 107, 122, 129, 142 | `GET /health` |
| 200 | `{"pong": true}` | 27 | 4, 25, 26, 28, 30, 32, 34, 36, 39, 43, 46, 48, 49, 50, 51, 52, 53, 55, 56, 57, 58, 59, 60, 61, 62, 85, 145 | `POST /msg {"m": "PING;64"}` |
| 200 | `{"cuenta_id": "AC-0001", "saldo": 0}` | 2 | 8, 109 | `POST /msg {"m": "CONSULTA;AC-0001;14"}` |
| 200 | `{"status": "recieved", "operacionId": "OP-0001"}` | 1 | 9 | `POST /msg {"m": "DEPOSITO;AC-0001;250000;86"}` |
| 200 | `{"status": "recieved", "operacionId": "OP-0002"}` | 1 | 10 | `POST /msg {"m": "TRANSFER;AC-0001;AC-0002;40000;86"}` |
| 200 | `{"cuenta_id": "AC-0002", "saldo": 40000}` | 1 | 11 | `POST /msg {"m": "CONSULTA;AC-0002;11"}` |
| 200 | `{"status": "recieved", "operacionId": "OP-0003"}` | 1 | 13 | `POST /msg {"m": "TRANSFER;AC-0001;AC-0002;100000;12"}` |
| 200 | `{"cuenta_id": "AC-0001", "saldo": 110000}` | 1 | 14 | `POST /msg {"m": "CONSULTa;AC-0001;14"}` |
| 200 | `{"ok": true, "anulada": "OP-0003"}` | 1 | 16 | `POST /msg {"m": "ANULA;OP-0003;66"}` |
| 200 | `{"ok": false, "motivo": "ya anulada"}` | 1 | 17 | `POST /msg {"m": "ANULA;OP-0003;66"}` |
| 200 | `{"status": "recieved", "operacionId": "OP-0004"}` | 1 | 21 | `POST /msg {"m": "DEPOSITO;AC-0002;700;35"}` |
| 200 | `{"cuenta_id": "AC-0002", "saldo": 40700}` | 1 | 22 | `POST /msg {"m": "CONSULTA;AC-0002;11"}` |
| 201 | `{"cuentaId": "AC-0001"}` | 4 | 6, 108, 130, 147 | `POST /msg {"m": "ALTA;Lucia;82"}` |
| 201 | `{"cuentaId": "AC-0002"}` | 2 | 7, 150 | `POST /msg {"m": "ALTA;Mateo;3"}` |
| 400 | `{"error": "E202", "mensaje": "control inválido"}` | 16 | 5, 31, 79, 80, 81, 82, 86, 110, 123, 125, 128, 131, 134, 136, 138, 140 | `POST /msg {"m": "ALTA;Lucia;83"}` |
| 400 | `{"error": "E301", "mensaje": "comando desconocido "}` | 2 | 15, 141 | `POST /msg {"m": "SALDOS;AC-0001;38"}` |
| 400 | `{"error": "E201", "mensaje": "control mal formado"}` | 15 | 20, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 132, 133, 135, 137 | `POST /msg {"m": "DEPOSITO;AC-0002;700;5X"}` |
| 400 | `{"error": "E302", "mensaje": "aridad inválida"}` | 4 | 23, 67, 68, 139 | `POST /msg {"m": "ALTA;Lucia;Gomez;11"}` |
| 400 | `{"error": "E100", "mensaje": "json inválido"}` | 2 | 33, 42 | `POST /msg 'xx'` |
| 400 | `{"error": "E102", "mensaje": "falta m"}` | 3 | 40, 41, 146 | `POST /msg {}` |
| 400 | `{"error": "E104", "mensaje": "segmento vacío"}` | 5 | 54, 65, 66, 87, 112 | `POST /msg {"m": "PING;"}` |
| 400 | `{"error": "E301", "mensaje": "comando desconocido ", "sugerencia": "PING"}` | 3 | 63, 78, 88 | `POST /msg {"m": " PING;64"}` |
| 400 | `{"error": "E103", "mensaje": "falta control"}` | 3 | 64, 143, 144 | `POST /msg {"m": "PING"}` |
| 400 | `{"error": "E301", "mensaje": "comando desconocido ", "sugerencia": "ALTA"}` | 2 | 83, 84 | `POST /msg {"m": " ALTA;Lucia;82"}` |
| 401 | `{"error": "E001", "mensaje": "no autorizado"}` | 14 | 1, 37, 38, 70, 71, 94, 95, 96, 97, 98, 99, 100, 101, 102 | `GET /health` |
| 404 | `{"error": "E401", "mensaje": "cuenta inexistente"}` | 4 | 18, 124, 126, 127 | `POST /msg {"m": "CONSULTA;AC-0009;87"}` |
| 404 | `{"error": "E404", "mensaje": "ruta desconocida"}` | 18 | 29, 35, 44, 45, 69, 72, 73, 74, 75, 77, 89, 90, 91, 92, 103, 104, 105, 106 | `GET /nada` |
| 404 | `''` | 1 | 93 | `HEAD /msg` |
| 413 | `{"error": "E101", "mensaje": "cuerpo demasiado grande"}` | 2 | 148, 149 | `POST /msg {"m": "ALTA;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...(+19937 chars)` |
| 422 | `{"error": "E506", "mensaje": "límite excedido"}` | 1 | 12 | `POST /msg {"m": "TRANSFER;AC-0001;AC-0002;120000;55"}` |
| 422 | `{"error": "E507", "mensaje": "saldo insuficiente"}` | 1 | 19 | `POST /msg {"m": "TRANSFER;AC-0002;AC-0001;50000;23"}` |

### Codigos de error

| codigo | mensaje exacto | status | ids | ojo |
|---|---|---|---|---|
| E001 | `'no autorizado'` | [401] | 1, 37, 38, 70, 71, 94, 95, 96, 97, 98, 99, 100, 101, 102 |  |
| E100 | `'json inválido'` | [400] | 33, 42 |  |
| E101 | `'cuerpo demasiado grande'` | [413] | 148, 149 |  |
| E102 | `'falta m'` | [400] | 40, 41, 146 |  |
| E103 | `'falta control'` | [400] | 64, 143, 144 |  |
| E104 | `'segmento vacío'` | [400] | 54, 65, 66, 87, 112 |  |
| E201 | `'control mal formado'` | [400] | 20, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 132, 133, 135, 137 |  |
| E202 | `'control inválido'` | [400] | 5, 31, 79, 80, 81, 82, 86, 110, 123, 125, 128, 131, 134, 136, 138, 140 |  |
| E301 | `'comando desconocido '` | [400] | 15, 141 | varios mensajes para el mismo codigo |
| E301 | `'comando desconocido ' + sugerencia` | [400] | 63, 78, 83, 84, 88 | varios mensajes para el mismo codigo |
| E302 | `'aridad inválida'` | [400] | 23, 67, 68, 139 |  |
| E401 | `'cuenta inexistente'` | [404] | 18, 124, 126, 127 |  |
| E404 | `'ruta desconocida'` | [404] | 29, 35, 44, 45, 69, 72, 73, 74, 75, 77, 89, 90, 91, 92, 103, 104, 105, 106 |  |
| E506 | `'límite excedido'` | [422] | 12 |  |
| E507 | `'saldo insuficiente'` | [422] | 19 |  |

## 3. Contradicciones

Aviso: probe.py solo registra `auth_sent` cuando se pasa `--auth-raw`; un `--no-auth` queda igual que una peticion con token. Las filas con 401 E001 pueden ser ese caso y no una contradiccion real. Revisar contra la conclusion de cada id.

### A. Mismo request tras el mismo prefijo desde /__reset

| prefijo (longitud) | request | ids | respuestas |
|---|---|---|---|
| 1 | `POST /__reset` | 3, 24, 47, 70, 76, 107, 122, 129, 142 | 3: {"ok": true}; 24: {"ok": true}; 47: {"ok": true}; 70: {"error": "E001", "mensaje": "no autorizado"}; 76: {"ok": true}; 107: {"ok": true}; 122: {"ok": true}; 129: {"ok": true}; 142: {"ok": true} |
| 2 | `POST /msg {"m": "PING;64"}` | 4, 25, 48, 71 | 4: {"pong": true}; 25: {"pong": true}; 48: {"pong": true}; 71: {"error": "E001", "mensaje": "no autorizado"} |

### B. Misma peticion aislada con respuestas distintas (revisar: estado o version)

| request | ids | respuestas |
|---|---|---|
| `GET /health` | 1, 2, 27, 95, 96 | 1: 401 {"error": "E001", "mensaje": "no autorizado"}; 2: 200 {"ok": true}; 27: 200 {"ok": true}; 95: 401 {"error": "E001", "mensaje": "no autorizado"}; 96: 401 {"error": "E001", "mensaje": "no autorizado"} |
| `POST /__reset` | 3, 24, 47, 70, 76, 107, 122, 129, 142 | 3: 200 {"ok": true}; 24: 200 {"ok": true}; 47: 200 {"ok": true}; 70: 401 {"error": "E001", "mensaje": "no autorizado"}; 76: 200 {"ok": true}; 107: 200 {"ok": true}; 122: 200 {"ok": true}; 129: 200 {"ok": true}; 142: 200 {"ok": true} |
| `POST /msg {"m": "PING;64"}` | 4, 25, 26, 28, 30, 32, 34, 36, 37, 38, 39, 43, 46, 48, 71, 99, 100 | 4: 200 {"pong": true}; 25: 200 {"pong": true}; 26: 200 {"pong": true}; 28: 200 {"pong": true}; 30: 200 {"pong": true}; 32: 200 {"pong": true}; 34: 200 {"pong": true}; 36: 200 {"pong": true}; 37: 401 {"error": "E001", "mensaje": "no autorizado"}; 38: 401 {"error": "E001", "mensaje": "no autorizado"}; 39: 200 {"pong": true}; 43: 200 {"pong": true}; 46: 200 {"pong": true}; 48: 200 {"pong": true}; 71: 401 {"error": "E001", "mensaje": "no autorizado"}; 99: 401 {"error": "E001", "mensaje": "no autorizado"}; 100: 401 {"error": "E001", "mensaje": "no autorizado"} |
| `POST /msg {"m": "CONSULTA;AC-0002;11"}` | 11, 22 | 11: 200 {"cuenta_id": "AC-0002", "saldo": 40000}; 22: 200 {"cuenta_id": "AC-0002", "saldo": 40700} |
| `POST /msg {"m": "ANULA;OP-0003;66"}` | 16, 17 | 16: 200 {"ok": true, "anulada": "OP-0003"}; 17: 200 {"ok": false, "motivo": "ya anulada"} |

## 4. Comandos y aridades

Aridad = nº de segmentos entre el comando y el control (`CMD;a1;...;control`). Agrupado sin distinguir mayusculas ni espacios.

| comando | variantes vistas (raw) | aridades | status | nº | ids (muestra) |
|---|---|---|---|---|---|
| (vacio) | '', '   ' | 0, sin control | [400] | 3 | 87, 143, 144 |
| ALTA | ' ALTA', 'ALTA', 'ALTA ' | 1, 2 | [201, 400, 413] | 15 | 5, 6, 7, 23, 31, 83, 84, 108, 130, 134, 135, 147 ... |
| ALTAS | 'ALTAS' | 1 | [400] | 1 | 82 |
| ANULA | 'ANULA' | 1 | [200] | 2 | 16, 17 |
| CONSULTA | 'CONSULTA', 'CONSULTa' | 0, 1 | [200, 400, 404] | 28 | 8, 11, 14, 18, 22, 109, 110, 111, 112, 113, 114, 115 ... |
| DEPOSITO | 'DEPOSITO' | 2 | [200, 400] | 3 | 9, 20, 21 |
| FOO | 'FOO' | 0 | [400] | 2 | 140, 141 |
| PIN | 'PIN' | 0 | [400] | 1 | 79 |
| PING | ' PING', 'PING', 'PING ', 'Ping', 'pinG', 'ping' | 0, 1, sin control | [200, 400, 401, 404] | 47 | 4, 25, 26, 28, 30, 32, 34, 36, 37, 38, 39, 43 ... |
| PINGG | 'PINGG' | 0 | [400] | 1 | 80 |
| PONG | 'PONG' | 0 | [400] | 1 | 81 |
| SALDO | 'SALDO' | 1 | [400] | 1 | 86 |
| SALDOS | 'SALDOS' | 0, 1 | [400] | 4 | 15, 131, 132, 133 |
| TRANSFER | 'TRANSFER' | 3 | [200, 422] | 4 | 10, 12, 13, 19 |

Registros /msg sin campo `m` en string (no contados aqui): 9.
