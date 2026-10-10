# Especificación de la caja negra

Autor: spec-writer. Fuente única de evidencia: `experimentos.jsonl` (los `id` citados son los de ese log).
Los ejemplos de `material/pruebas/ejemplos.jsonl` **no se usan como evidencia**: lo que contienen está
citado solo a través de su reproducción en nuestro log (ids 4-23).

Cobertura del log: ids 1-731 (relectura completa; ver "Cierre" al final). Última línea del log: id 731,
2026-10-10T13:00:14-0500. Nada de lo que ocurra después de esa hora está en esta spec.

## Convenciones

- `id N` / `ids N-M` = línea(s) de `experimentos.jsonl`. `x_req` = valor del header `X-Req` de la respuesta.
- Confianza: **confirmado** = observado en al menos dos requests independientes con el mismo resultado;
  **probable** = observado una vez o inferido de lo observado; **supuesto** = no probado (default del reemplazo).
  Las afirmaciones sin ningún `id` **no están en las tablas**: van en las listas "Desconocido" bajo cada sección.
- Los cuerpos se dan como JSON compacto. El set compara JSON sin orden de claves; los strings son exactos
  (acentos UTF-8, espacios finales, typos incluidos).
- Todas las respuestas observadas con cuerpo son JSON. Única excepción: las respuestas a `HEAD` (`HEAD /msg` sin token, id 93;
  `HEAD /health` y `HEAD /msg` con token, ids 614 y 615): status 404 y cuerpo vacío (`""`).
- Los quirks se describen tal cual; no se corrigen.
- IDs retirados (no reutilizar): `ENT-11`.
- Las líneas del log desde el id 339 llevan un campo `ts` (hora local, offset -0500); las anteriores no.

---

## 1. Entrada

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| ENT-1 | Las únicas combinaciones ruta+método con comportamiento propio son `GET /health`, `POST /__reset` y `POST /msg`. Todo lo demás cae en ENT-6. | 2, 3, 4 (las tres válidas); 35, 44, 45, 89, 90, 91, 92 (otros métodos sobre ellas = 404); 93, 614, 615 (HEAD = 404, ENT-9) | confirmado |
| ENT-2 | `GET /health` con token válido: **200** `{"ok":true}`. Sin header `X-Req` y no cuenta para `X-Req`. | 2, 27 | confirmado |
| ENT-3 | `POST /__reset` con token válido: **200** `{"ok":true}`, sin header `X-Req`. Sin cuerpo en la mayoría de las pruebas; con query `?x=1` (618) y con un cuerpo de ≈8300 bytes (577, no le aplica el límite de ENT-14) responde igual (una muestra cada uno: probable). | 3, 24, 47, 76, 107, 122, 129; 577, 618 | confirmado (sin cuerpo) / probable (query, cuerpo grande) |
| ENT-4 | Autenticación = header `Authorization: Bearer <token>`. Cualquiera de estos casos da **401** `{"error":"E001","mensaje":"no autorizado"}`, siempre el mismo cuerpo (no distingue "falta" de "inválido"): sin header, `Bearer ` vacío, token inventado, esquema `Basic`, esquema `bearer` en minúscula, y también `bearer <token válido>` y `Basic <token válido>` (el esquema se compara exacto: solo `Bearer`). Aplica a `GET /health`, `POST /msg` y `POST /__reset`: las tres exigen token (incluido `/health`). | `/health`: 1, 95, 96, 97, 98, 425 (`bearer` + token válido), 427 (`Basic` + token válido); `/msg`: 37, 38, 71, 94, 99, 100, 101, 102, 426 (`bearer` + token válido), 428 (`Basic` + token válido); `/__reset`: 70 | confirmado |
| ENT-5 | La auth se evalúa **después** del ruteo (ruta+método) y **antes** de leer/parsear el cuerpo de `/msg`: un cuerpo válido o no-JSON sin token da 401 E001 igual. | ruteo antes que auth: 69, 72, 73, 89, 90, 91, 92, 103, 104, 105, 106; auth antes que cuerpo: 71, 94 (válido sin token y no-JSON sin token, mismo 401) | confirmado |
| ENT-6 | Ruta o método no soportado (incluida la raíz `/`) responde **404** `{"error":"E404","mensaje":"ruta desconocida"}`, con o sin token, con token válido o inválido, para cualquier método. No lleva `X-Req` y no cuenta. Excepción de formato: `HEAD` también da 404 pero con cuerpo vacío (ENT-9). Con cuerpo de ≈8300 bytes sigue siendo 404 (no 413): POST /nada con y sin token, POST /health. | GET /nada: 29, 72, 103; POST /nada: 73, 104; GET /: 74; GET /msg: 35; POST /health: 44, 69; GET /__reset: 45; PUT /msg: 89, 106; DELETE /msg: 90; PATCH /msg: 91; OPTIONS /msg: 92 (x_req null en 29, 35, 44, 45); con cuerpo grande: 574, 575, 578 (x_req null) | confirmado |
| ENT-7 | El ruteo distingue mayúsculas: `GET /HEALTH` es 404 E404 (no es `/health`), sin token (77) y con token **inválido** (105); `POST /MSG` con token válido también es 404 E404 y no cuenta `X-Req` (613). (No se probó `GET /HEALTH` con token válido.) | 77, 105, 613 | confirmado |
| ENT-8 | El ruteo no normaliza la barra final: `GET /health/` es 404 E404 sin token (75) y con token válido (617); `POST /msg/` con token válido también (611, sin `X-Req`). | 75, 617, 611 | confirmado |
| ENT-9 | `HEAD` no está soportado: `HEAD /msg` sin token (93), `HEAD /msg` con token válido (615) y `HEAD /health` con token válido (614) dan status **404** con cuerpo vacío (`""`), sin `X-Req`. No se probó `HEAD` sobre `/__reset`, sobre rutas inexistentes ni con token inválido. | 93, 615 (`/msg`); 614 (`/health`) | confirmado (`HEAD /msg`) / probable (`HEAD /health`) |
| ENT-10 | Cuerpo de `POST /msg` = objeto JSON con la clave `m` de tipo string, p. ej. `{"m":"PING;64"}`. Cuerpo no-JSON (`xx`) o vacío: 400 E100. Objeto sin `m` (`{}`), con `m` no string (`{"m":5}`) o un array JSON (`[]`): 400 E102. Cuerpos y `m` inválidos cuentan para `X-Req` (ver MEM-1). | 4 (válido); 33, 42 (E100); 40, 41, 146 (E102) | confirmado |
| ENT-12 | Las claves extra en el objeto se ignoran: `{"m":"PING;64","x":1}` → 200 `{"pong":true}`. (Salvo que el cuerpo pase de 8192 bytes: con una clave extra enorme da 413, ENT-14.) | 145; 573 | probable |
| ENT-13 | `m` vacío (`""`) o solo espacios (`"   "`) con token válido: 400 E103 `falta control` (no E102 ni E104; se trata como un mensaje sin ningún `;`). | 143, 144 | confirmado |
| ENT-14 | **Límite de tamaño = 8192 bytes (8 KiB) del cuerpo crudo de `POST /msg`**: un cuerpo de hasta 8192 bytes inclusive se procesa normal (201 en las pruebas); de 8193 bytes en adelante → **413** `{"error":"E101","mensaje":"cuerpo demasiado grande"}`. Se midió con cuerpos `{"m": "ALTA;AAAA…;<ctrl>"}` (JSON con espacio tras `:`, tal como lo manda `tools/probe.py`): 8192 bytes → 201 (id 511); 8193 → 413 (id 503). Los ids 503 y 511 se recontaron sobre la línea del log (503: 8176 `A` + control de 2 dígitos = 8193 bytes; 511: 8175 `A` + control de 2 dígitos = 8192 bytes); el resto de cifras de bytes son las de la conclusión de cada línea. Bisección completa: 413 con 8193, 8194, 8195, 8197, 8201, 8210, 8312, 8520; 201 con 8103, 8158, 8187, 8189, 8190. Cuenta **bytes UTF-8**, no caracteres: 60 `ñ` (2 bytes) con el mismo número de caracteres que 511 → 413 (cuerpo de 8252 bytes); con una sola `ñ` y cuerpo de 8192 bytes → 201. Cuenta el **cuerpo entero, no `m`**: `{"m":"PING;64", "a":"xxx…"}` de ≈8300 bytes → 413. Referencias previas: `m` de ≈2000 y ≈6000 caracteres → 201 (cuerpo ≈6017 bytes); ≈8500, ≈11000 y ≈20000 → 413. Orden frente a otros errores: ERR-29. | 503 (8193 → 413), 511 (8192 → 201); 485 (8103), 491 (8158), 493 (8187), 505 (8189), 507 (8190) → 201; 489 (8210), 495 (8201), 497 (8197), 499 (8195), 501 (8194), 486 (8312), 487 (8520) → 413; 513 (60 `ñ`, 8252 bytes → 413), 515 (1 `ñ`, 8192 bytes → 201); 573 (`m` válido + clave extra, ≈8300 bytes → 413); 147, 150 (≈2000/≈6000 → 201), 429, 149, 148 (≈8500/≈11000/≈20000 → 413); 475-484 (6020…7895 bytes → 201); 672, 710 (413 repetido a las 12:00 y 13:00) | confirmado |
| ENT-15 | Todo JSON **válido** que no sea un objeto con `m` de tipo string → 400 **E102** `falta m` (nunca E100): cuerpo `null` (598), cuerpo string JSON `"PING;64"` (601), `{"m":null}` (599), `{"m":["PING;64"]}` (600; el array no se coerciona), `{"M":"PING;64"}` (602; la clave es `m` en minúscula, sensible a mayúsculas), y además `{}`, `{"m":5}` y `[]` (ENT-10). En el log, 598 guarda `request: null` y 601 guarda `request: "PING;64"` (valor decodificado); el cuerpo crudo enviado es el que dice su `hipotesis`/`conclusion` (`null` y `"PING;64"`). Todos cuentan `X-Req` (x_req 506-510). | 598, 599, 600, 601, 602; 40, 41, 146 | confirmado (la clase E102); cada variante nueva (598-602) tiene una sola muestra |
| ENT-16 | Cuerpo con la clave `m` **duplicada** (`{"m":"x","m":"PING;64"}`): gana la **última** (responde `{"pong":true}`; con la primera habría dado E103). Una sola muestra. | 603 | probable |
| ENT-17 | Parser JSON estricto sobre el texto del cuerpo: JSON válido seguido de basura (`{"m":"PING;64"}xx`) → 400 E100 `json inválido` (604); BOM UTF-8 antes del JSON → E100 (606); un formulario real (`m=PING%3B64`, con `Content-Type: application/x-www-form-urlencoded`) → E100 (609). Espacios, saltos de línea y tabuladores alrededor del JSON se admiten → 200 `{"pong":true}` (605). Una muestra cada uno. | 604, 606, 609, 605 | probable |
| ENT-18 | El `Content-Type` se **ignora**: `text/plain` (607), `application/x-www-form-urlencoded` (608) y `application/json; charset=latin-1` (610) con un JSON válido en el cuerpo → 200 `{"pong":true}`. Cuentan `X-Req` (515, 516, 518). | 607, 608, 610 | confirmado |
| ENT-19 | El query string se ignora en el ruteo: `POST /msg?x=1` se procesa (200 `{"pong":true}`, cuenta `X-Req`=519), `GET /health?x=1` → 200 `{"ok":true}`, `POST /__reset?x=1` → 200 `{"ok":true}`. Una muestra por ruta. | 612, 616, 618 | probable |
| ENT-20 | El límite de ENT-14 solo aplica a `POST /msg` autenticado: `GET /health` y `POST /__reset` con token y cuerpo de ≈8300 bytes responden 200 `{"ok":true}` (una muestra cada uno). | 576, 577 | probable |

**Desconocido (sin id; el reemplazo usa un default = supuesto)**: cuerpo JSON `5` o `true` (solo se probaron `null`, string,
array y objetos); cuerpo con bytes UTF-8 inválidos o con `Content-Length` inconsistente; `HEAD` sobre `/__reset`, sobre rutas
inexistentes o con token inválido; `OPTIONS`/`PUT`/`DELETE` sobre `/health` y `/__reset` con token (solo `OPTIONS /msg` sin
token, id 92); esquemas de auth `BEARER`, `Bearer` con doble espacio o con espacio final, o token sin esquema (solo se probaron
`bearer` y `Basic`, ENT-4); `GET /health` con cuerpo pequeño; si el límite de 8192 bytes mide el cuerpo leído o el header
`Content-Length` (no se distinguió); rate-limit del original (el header `X-Frontier-Infra` nunca apareció en el log: ninguna
línea tiene el campo `infra`, que `tools/probe.py` escribe cuando el header aparece; pero `tools/probe.py` espera 120 ms entre
requests y con los ≈220 ms medidos en `ms` el ritmo es ≈3 req/s, por debajo de 10 req/s, y el log suma 731 líneas, lejos de
8.000/día; es decir, el límite nunca se puso a prueba); aislamiento entre tokens (el estado visto es de un único contador
`X-Req`; todas las líneas con token válido llevan `"auth": "team"`, que no distingue qué token real se usó; el README del
material afirma el aislamiento pero no lo probamos).

---

## 2. Integridad

Un mensaje es `CMD;arg1;...;argN;control`: se parte por `;`, el **último** campo es el control y el primero es el comando.

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| INT-1 | El **último** segmento siempre se trata como control, aunque sea un argumento: `CONSULTA;AC-0001` (sin control) → E201 porque `AC-0001` no es un número; `SALDOS;AC-0001` ídem. | 113, 133 | confirmado |
| INT-2 | Fórmula del control (checksum tipo MOD 97-10 con letras A=1..Z=26): `payload` = el mensaje sin el último `;` ni lo que sigue; `N` = número decimal que resulta de concatenar, por cada carácter del payload **en mayúsculas**, el propio dígito (`0`-`9`) o la posición de la letra en el alfabeto escrita en decimal (A=1 … Z=26); el resto de caracteres no aporta nada (INT-15); `control = 98 - ((100·N) mod 97)` (rango 2..98). Ej.: `PING` → N=169147 → control 64; `ALTA;Lucia` → N=1122011221391 → 82. | los 20 mensajes del canario reproducen exactamente: 4-23 (control aceptado, es decir, se llega a la respuesta de negocio o a un error posterior, en 4 y 6-19, 21-23; E202 por control erróneo en 5; E201 en 20); mismo `ALTA;Lucia;82` → 201 en 108, 130 y 340; `CONSULTA;AC-0001;14` en 109 | confirmado |
| INT-3 | La comparación es **exacta** (no por congruencia ni "cualquier número"): `ALTA;Lucia;83` (83 ≠ 82) → E202; `CONSULTA;AC-0001;15` (≠ 14) → E202. Además es **textual**: con control correcto `2`, el campo `02` (mismo valor numérico) pasa la forma pero da E202, mientras `2` pasa (E401); igual `ALTA;Mateo;03` → E202 y `ALTA;Mateo;3` → 201. | 5, 31, 110, 152 (`02` → E202), 153 (`2` → E401), 360 (`03` → E202), 361 (`3` → 201) | confirmado |
| INT-4 | **Bordes de la fórmula** (decide 98-… frente a 1-3N): con `CONSULTA;AC-0038` el control aceptado es **97** (0 se rechaza); con `CONSULTA;AC-0070` el aceptado es **98** (1 se rechaza); con `CONSULTA;AC-0005` se acepta 2 y se rechaza 99. Aceptado = pasa el control y llega a E401 (cuentas inexistentes); rechazado = E202. Descarta el rango 0..96 (`1-3N`) y la validación por congruencia mod 97. | 123 (AC-0038;0 → E202), 124 (AC-0038;97 → E401), 125 (AC-0070;1 → E202), 126 (AC-0070;98 → E401), 127 (AC-0005;2 → E401), 128 (AC-0005;99 → E202) | confirmado |
| INT-5 | Las letras en minúscula pesan igual que en mayúscula (`Lucia`, `LUCIA`, `lucia`, `CONSULTa`): el control es el mismo. | 6, 108, 130 (`Lucia`); 14 (`CONSULTa;AC-0001;14` → 200); 342 (`LUCIA;82` → 201), 343 (`lucia;82` → 201) | confirmado |
| INT-6 | El espacio no aporta al control: `" PING;64"`, `"PING ;64"`, `" ALTA;Lucia;82"`, `"ALTA ;Lucia;82"` pasan el control (con el mismo control que sin espacio) y fallan después con E301; `ALTA;Lucia ;82` (espacio final en el nombre) y `ALTA;Lucia Gomez;11` se aceptan (201). | 63, 78, 83, 84, 88 (E301 tras pasar el control); 345 (`Lucia ;82` → 201), 344 (`Lucia Gomez;11` → 201); 379, 380, 384, 385 (`consulta ;`, `C ONSULTA` con control 14 → E301 tras pasar el control) | confirmado |
| INT-7 | Forma del control: solo se aceptan **1 o 2 dígitos decimales sin signo, sin espacios ni decimales**. Mal formado → 400 **E201**: `XX`, `5X`, `014`, `0014`, `+14`, ` 14`, `14 `, `111`, `14.0`, `-83`, `82\n` y `82\r` (el control no se recorta: 622, 623), y un argumento en lugar del control. Aceptados como forma (llegan a la comparación y dan E202 o E401): `0`, `1`, `2`, `02`, `03`, `14`, `15`, `97`, `98`, `99`. (`02`/`03` pasan la forma —2 caracteres— pero fallan la comparación textual, INT-3; `014` no pasa la forma —3 caracteres—.) | E201: 20, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 132, 133, 135, 137, 622, 623; formas aceptadas: 110, 123, 124, 125, 126, 127, 128, 152, 153, 360 | confirmado |
| INT-8 | Segmento vacío (incluido el control vacío `CONSULTA;AC-0001;`, el comando vacío `;64`, `PING;;`, el monto vacío `DEPOSITO;AC-0001;;4`, el argumento vacío `ANULA;;45` y el nombre vacío `ALTA;;5`) → 400 **E104** `segmento vacío`; se evalúa **antes** que E201/E202/E303/pong. | 54, 65, 66, 87, 112, 183, 249, 358 | confirmado |
| INT-9 | Mensaje sin ningún `;` (`PING`, `""`, `"   "`) → 400 **E103** `falta control`. Los espacios no cuentan como `;`. Probado con `PING` y con `m` vacío/espacios, no con otros nombres de comando. | 64, 143, 144 | confirmado |
| INT-10 | **PING no valida el control**: `PING;00`, `;63`, `;65`, `;99`, `;XX`, `;100`, `;064`, `;6`, `;-1`, `; 64`, `;64 ` responden todos `{"pong":true}`. PING sí valida la estructura (E103, E104) y la aridad (E302). | pong: 49, 50, 51, 52, 53, 55, 56, 57, 58, 61, 62; estructura/aridad: 54, 64, 65, 66, 67, 68 | confirmado |
| INT-11 | El nombre del comando **no se recorta**: con espacios, tabulador o salto de línea al principio, al final o dentro (`" PING"`, `"ALTA "`, `"PING "`, `"CONSULTA\t"`, `"C ONSULTA"`, `"PING\n"`, `"\nALTA"`) no se reconoce el comando y da E301 con el campo extra `sugerencia` (ERR-9). El control se calcula ignorando esos caracteres (INT-15), por eso el control normal pasa y el error es E301 y no E202. | 63, 78, 83, 84, 88, 379, 380, 381, 382, 383, 384, 385; 624 (`PING\n;64`), 631 (`\nALTA;Lucia;82`) | confirmado |
| INT-12 | El nombre del comando es **insensible a mayúsculas**: `ping`, `Ping`, `pinG`, `CONSULTa` ejecutan el comando. | 59, 60, 85, 14 | confirmado |
| INT-13 | El control se valida **también para comandos desconocidos** y antes de resolver el comando: `PIN;64`, `PINGG;64`, `PONG;64`, `ALTAS;Lucia;1`, `SALDO;AC-0001;1`, `FOO;54` → E202; con control correcto, `SALDOS;AC-0001;38`, `FOO;47` y `PIN;AC-0001;29` → E301. | E202: 79, 80, 81, 82, 86, 140; E301: 15, 141, 373 | confirmado |
| INT-14 | Orden de las comprobaciones de integridad (de más temprana a más tardía): estructura (E103/E104) → [PING sale aquí con pong o E302] → forma del control (E201) → valor del control (E202) → comando (E301) → aridad (E302) → monto (E303) → resto de reglas de negocio (ERR-26 a ERR-28). Cada error de control gana contra el siguiente error aunque el mensaje tenga ambos (probado con E301, E302 y E401; contra E303 solo se infiere por transitividad: E202 antes que E302, E302 antes que E303). | E201/E202 ganan: 131 (SALDOS), 132, 134 (ALTA aridad), 135, 136 (CONSULTA cuenta inexistente), 137, 138 (CONSULTA aridad), 140 (FOO); con control correcto aparece el segundo error: 139 (E302), 141 (E301), 23 (E302), 18 (E401); E104 antes que E201: 112; comando desconocido con cualquier nº de argumentos y control correcto → E301, nunca E302: 156 (4 args), 158 (1 arg), 373; comando conocido con aridad mala → E302: 157, 159, 356, 357; E302 gana a E303/E401/E402/E304/E506/E507 (control correcto): 549-562 | confirmado |
| INT-15 | Solo pesan en el control los caracteres ASCII `0-9`, `A-Z`, `a-z`. **No aportan nada**: espacio, tabulador, salto de línea `\n`, `-`, `.`, y caracteres no ASCII (`é`, `ñ`, `ú`, `日本`); con una sola muestra cada uno tampoco aportan `\x01`, `\x7f` (según la conclusión de 628, la línea muestra el carácter invisible) y U+200B (621, 626-629 dan 201: el control calculado ignorando el carácter pasa; 633 y 634, montos con `\n`, dan E303 y no distinguen si el control pasó, porque el orden E202 frente a E303 no se probó directamente: solo se infiere por transitividad, E202 antes que E302 y E302 antes que E303). (`,`, `+`, `_` y dígitos árabes `١٠٠` se comportan igual según los montos de 164-168, 176-178, que dieron E303 y no E202; eso asume que E303 se evalúa después del control, no probado.) Prueba directa: `Lucia ;82` = `Lucia;82`; `Ana-Maria;44` y `Ana.Maria;44` comparten control; `日本;85` y `   ;85` comparten control; `José;61` y `Ñandú;41` coinciden con el cálculo que ignora `é`, `Ñ`, `ú`. | 345, 352, 353, 351, 354, 348, 349, 381 (tab, control 14); `\n`: 621, 630 (201), 631, 624 (E301 tras el control), 632 (E401 tras el control); `\t` en un nombre: 626; `\x01`: 627; `\x7f`: 628; U+200B: 629; `,` `+` `_` árabes: 164-168, 176-178 | confirmado (espacio, tab, `\n`, `-`, `.`, no ASCII) / probable (`\x01`, `\x7f`, U+200B, `,`, `+`, `_`, dígitos árabes) |
| INT-16 | **Gramática del monto** (DEPOSITO y TRANSFER, mismo campo): solo es válido un entero decimal **canónico**: dígitos ASCII, sin signo, sin cero a la izquierda, sin separadores, de 1 a 10 dígitos y mayor que 0. Cualquier otra cosa → 400 **E303** `monto inválido`. Aceptados: `1`, `5000`, `1000000`, `10000000`, `100000000`, `1000000000`, `2147483648`, `4294967296`, `9999999999`. Rechazados: `0`, `00`, `-0`, `-5`, `100.5`, `100,5`, `+100`, ` 100`, `100 `, `100<tab>`, `5\n`, `\n5`, `0100`, `007`, `1e3`, `1e9`, `abc`, `1,000`, `1_000`, `0x10`, dígitos árabes `١٠٠`, y todo valor de **11 o más dígitos** (`10000000000`, `99999999999`, `9007199254740991`, `99999999999999999999`, …). El monto vacío es E104, no E303. | aceptados: 186, 188, 190, 192, 194, 196, 198, 204 (DEPOSITO), 214, 228 (TRANSFER); rechazados DEPOSITO: 162-182, 200-203, 205-210, 633, 634 (`5\n`, `\n5`); TRANSFER: 215-226, 323; vacío: 183 | confirmado |
| INT-17 | Los ids de entidad se comparan **exactos** (distinguen mayúsculas, espacios y ceros): para cuenta solo existe `AC-` + 4 dígitos real; `ac-0001`, `AC-1`, `AC-2`, `AC-00001`, `0001`, `AC-0001 ` (espacio final), `AC-0001\n` (salto de línea final) → E401. Para operación: `op-0001`, `OP-1`, `OP-00001`, `OP-0001 `, `0001`, `XX-1`, `OP-0000`, `OP-9999` y `AC-0001` → E402. (El nombre del comando sí es insensible a mayúsculas; los ids no.) | cuenta (E401): 312, 313, 314, 315, 316, 317, 318, 319, 331, 332, 632; operación (E402): 238, 239, 240, 241, 242, 243, 244, 245, 247 | confirmado |

**Desconocido**: pesos de otros caracteres de control no ASCII/ASCII raros (`/`, `#`, `€`, otros espacios Unicode) — solo se
probaron los de INT-15; controles de 3 o más dígitos distintos de `014`, `0014` y `111`; E104 frente a E202/E302 cuando
un mensaje de un comando no-PING tiene a la vez un segmento vacío y otro fallo (p. ej. `ALTA;;;85`, `TRANSFER;AC-0001;;10;<ctrl>`;
solo se probó un segmento vacío por mensaje: 183, 249, 358); `ping;00` en minúscula; E103 para mensajes sin `;` de otros
comandos (`CONSULTA`); orden directo E202 frente a E303 (solo inferido por transitividad, INT-14); distancia 3 por
inserción/borrado frente a sustitución en `sugerencia` (ERR-30).

---

## 3. Comandos

Seis comandos conocidos: `PING`, `ALTA`, `CONSULTA`, `DEPOSITO`, `TRANSFER`, `ANULA`. Todo el resto → E301 (ERR-9).
En las firmas, `<ctrl>` es el control de INT-2. Los efectos de estado están detallados en la sección 4.

### PING — `PING;<ctrl>` (0 argumentos)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-1 | `PING;<cualquier cosa no vacía>` → **200** `{"pong":true}`. El control no se valida (INT-10). | 4, 25, 26, 28, 48, 49, 50, 51, 52, 53, 55, 56, 57, 58, 59, 60, 61, 62, 85; 625 (`PING;64\n`) | confirmado |
| CMD-2 | Con argumentos de más (`PING;64;64`, `PING;1;64`) → 400 E302. | 67, 68 | confirmado |

### ALTA — `ALTA;<nombre>;<ctrl>` (1 argumento)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-3 | Crea una cuenta: **201** `{"cuentaId":"AC-0001"}` (clave `cuentaId`, camelCase). El id sale del contador de cuentas (MEM-5). | 6, 7, 108, 130, 340 | confirmado |
| CMD-4 | La cuenta nueva tiene saldo 0 (se ve con `CONSULTA`). | 8, 109, 362 | confirmado |
| CMD-5 | Aridad: dos argumentos (`ALTA;Lucia;Gomez;11`, `ALTA;Zed;Extra;89`) o cero (`ALTA;85`) → 400 E302. | 23, 356, 357 | confirmado |
| CMD-6 | El nombre es libre y no se valida: se aceptan mayúsculas/minúsculas, espacios internos o finales, solo espacios (`"   "`), dígitos, acentos, `ñ`, `-`, `.`, caracteres CJK (`日本`), saltos de línea, tabuladores y caracteres de control o invisibles dentro del nombre (`\n`, `\t`, `\x01`, `\x7f`, U+200B) y nombres de ≈2000 y ≈6000 caracteres. Nombre vacío → E104 (INT-8). No se ve ningún efecto del nombre en las respuestas. | 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 359, 361; 147, 150 (nombres largos); 621, 626, 627, 628, 629, 630 (caracteres de control en el nombre: 201) | confirmado |
| CMD-7 | ALTA no deduplica: el mismo nombre dos veces crea dos cuentas (`Lucia` → `AC-0001`, `Lucia` → `AC-0002`). | 340, 341 (y variantes 342-345) | confirmado |

### CONSULTA — `CONSULTA;<cuenta>;<ctrl>` (1 argumento)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-8 | Cuenta existente: **200** `{"cuenta_id":"AC-0001","saldo":0}` (clave `cuenta_id`, snake_case, distinta de `cuentaId` de ALTA); `saldo` es un entero JSON (puede superar 2^32 y puede ser negativo). | 8, 11, 14, 22, 109; 197, 199 (3258483649, 7553450945); 285 (-500), 585 (-900), 648 (-300) | confirmado |
| CMD-9 | Cuenta inexistente (con control correcto): **404** `{"error":"E401","mensaje":"cuenta inexistente"}`; vale también para ids mal formados (INT-17). | 18, 124, 126, 127, 316, 317, 318, 319, 363 | confirmado |
| CMD-10 | Cero argumentos (`CONSULTA;11`, control correcto) → 400 E302. | 139 | probable |

### DEPOSITO — `DEPOSITO;<cuenta>;<monto>;<ctrl>` (2 argumentos)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-11 | Éxito: **200** `{"status":"recieved","operacionId":"OP-0001"}` (typo `recieved` literal; clave `operacionId`). El id sale del contador de operaciones (MEM-7). | 9, 21, 186, 214, 236, 256, 309 | confirmado |
| CMD-12 | El monto se suma al saldo de la cuenta de inmediato (la consulta siguiente ya lo ve). | 9 → 14 (110000), 21 → 22 (40700), 186 → 187 (1), 188 → 189 (1000001), 190 → 191, 192 → 193, 194 → 195, 196 → 197, 198 → 199 | confirmado |
| CMD-13 | **DEPOSITO no tiene tope de monto**: se aceptan desde `1` hasta `9999999999` (el máximo es el de la gramática, INT-16), sin E506 ni desbordes de 32 bits. | 186, 188, 190, 192, 194, 196, 198, 204 | confirmado |
| CMD-14 | Aridad: con 0 argumentos (`DEPOSITO;<ctrl>`), 1 (`DEPOSITO;AC-0001;<ctrl>`, cuenta existente; también `DEPOSITO;abc;<ctrl>` y `DEPOSITO;AC-0009;<ctrl>`), 3 (`DEPOSITO;AC-0001;abc;x;<ctrl>`, `DEPOSITO;AC-0009;10;x;<ctrl>`) y 4 (`DEPOSITO;AC-0001;5;6;7;<ctrl>`) → 400 E302; la aridad gana a E303 y a E401 (CMD-33). | 157, 159, 548, 549, 550, 553, 561 | confirmado |
| CMD-15 | Monto inválido → 400 E303 (INT-16), también si la cuenta no existe (E303 gana a E401). Cuenta inexistente con monto válido → 404 E401. | E303: 162-182; 311 (`AC-0009;abc` → E303); E401: 310, 312, 313, 314, 315 | confirmado |

### TRANSFER — `TRANSFER;<origen>;<destino>;<monto>;<ctrl>` (3 argumentos)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-16 | Éxito: **200** `{"status":"recieved","operacionId":"OP-0002"}`, mismo formato que DEPOSITO. | 10, 13, 228, 237, 257, 300 | confirmado |
| CMD-17 | Resta el monto al origen y lo suma al destino. Ej.: tras depositar 250000 en AC-0001 y transferir 40000 a AC-0002, AC-0002 tiene 40000; tras otra de 100000, AC-0001 tiene 110000; tras transferir 1 de AC-0001 (saldo 5000) quedan 4999 y 1. | 9, 10, 11, 13, 14; 231, 232 | confirmado |
| CMD-18 | **Tope por operación de 100000**: un monto > 100000 → **422** `{"error":"E506","mensaje":"límite excedido"}` (120000, 100001, 9999999999); 100000 pasa. No es acumulado ni proporcional al saldo ni depende del destino: tres transferencias seguidas de 100000 con saldo 5000000 pasan; 120000 en estado fresco con saldo 1000006 (12 % del saldo, nada transferido antes) da E506, también a otro destino y repetido; y 9999999999 con saldo 5000 da E506 (no E507). | 12 (120000 → E506), 13 (100000 pasa), 300, 301, 302 (3×100000 pasan), 303 (100001 → E506), 227 (9999999999, saldo 5000 → E506), 398, 399, 400 (120000 con saldo 1000006: E506 ×3; saldos intactos en 401-403) | confirmado |
| CMD-19 | **Saldo insuficiente**: monto ≤ 100000 y mayor que el saldo del origen → **422** `{"error":"E507","mensaje":"saldo insuficiente"}` (5000 con saldo 4999, 5001, 1 con saldo 0, 50000 con saldo 40000, 600 con saldo 500). Con **saldo negativo** (tras ANULA, CMD-28) cualquier monto da E507 (1 con saldo -900). Transferir **exactamente el saldo** está permitido. | 19, 229, 230, 338, 594 (E507); 587 (1 con saldo -900 → E507); 335 (50 con saldo 50 → 200, saldo queda 0); 595 (500 con saldo 500 → 200, saldo queda 0) | confirmado |
| CMD-20 | Origen o destino inexistente (o ambos) → 404 E401, con cualquier monto válido (también > 100000 o > saldo: E401 gana a E506/E507). | 320, 321, 322, 324, 325, 326, 331, 332 | confirmado |
| CMD-21 | Origen == destino (cuenta existente) → 400 `{"error":"E304","mensaje":"origen y destino iguales"}`, con cualquier monto válido (gana a E506/E507); con monto inválido da E303. | 327, 328, 329 (E304); 330 (monto 0 → E303) | confirmado |
| CMD-22 | E506, E507, E401, E303 y E304 no consumen número de operación (ver MEM-8). | 227 → 228; 310-334 → 335 | confirmado |
| CMD-23 | Monto inválido → 400 E303 (INT-16), también con cuenta inexistente. | 215-226, 323 | confirmado |

### ANULA — `ANULA;<operacion>;<ctrl>` (1 argumento)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-24 | Anula la operación: **200** `{"ok":true,"anulada":"OP-0003"}`. Sirve para DEPOSITO y para TRANSFER. | TRANSFER: 16, 260, 283, 291, 591; DEPOSITO: 265, 269, 287, 584, 647 | confirmado |
| CMD-25 | Repetirla: **200** `{"ok":false,"motivo":"ya anulada"}` (fallo de negocio con status 200, no un error E-xxx). | 17, 263, 268, 295 | confirmado |
| CMD-26 | Anular una TRANSFER devuelve el monto al **origen** y se lo quita al **destino**: AC-0001 700 → 1000 y AC-0002 300 → 0. | 258, 259, 260, 261, 262; 280-284 | confirmado |
| CMD-27 | Anular un DEPOSITO resta el monto a la cuenta: depósito de 1000 anulado deja la cuenta en 50 (con otro depósito de 50) y luego 0 al anular el de 50. | 264, 265, 266, 269, 270; 287, 288 | confirmado |
| CMD-28 | **ANULA no comprueba fondos**: la anulación se aplica igual aunque el dinero ya se haya gastado y la cuenta afectada queda con saldo **negativo**. (a) TRANSFER: si el destino ya gastó el dinero, el destino queda en -500 (AC-0002); anular después la transferencia que lo gastó lo devuelve a 0. (b) DEPOSITO: depositar 1000 en AC-0001, transferir 900 y anular el depósito deja AC-0001 en **-900** (200 `{"ok":true,"anulada":"OP-0001"}`); en la otra prueba, depósito de 1000 y transferencia de 300 anulado a los 5 min deja -300. Con saldo negativo: TRANSFER → E507 (587); DEPOSITO suma normal (-900 + 500 = -400, 588-589); anular la TRANSFER de 900 devuelve 900 al origen (-400 → 500) y lo quita al destino (900 → 0). | (a) 277-285 (-500 en 285, 289), 291-293; (b) 583-585, 587-589, 591-593, 636-648 (-300 en 648) | confirmado |
| CMD-29 | ANULA (éxito o repetida) y los ANULA fallidos no consumen número de operación: la siguiente operación nueva es la siguiente de la serie. | 250 (OP-0003 tras 10 ANULA fallidos), 271 (OP-0004 tras 3 ANULA exitosos y 2 repetidos), 21; 588 (OP-0003 tras un ANULA exitoso, 584), 595 (OP-0004 tras ANULA repetido 590, ANULA exitoso 591 y un E507, 594), 655 (OP-0003 tras dos ANULA exitosos, 647 y 652) | confirmado |
| CMD-30 | Operación inexistente o mal formada → **404** `{"error":"E402","mensaje":"operación inexistente"}` (con acento). Vale para `OP-9999`, `OP-0000`, `OP-0003` aún no creada, `XX-1`, `op-0001`, `OP-1`, `OP-00001`, `OP-0001 `, `0001` y `AC-0001`. | 238-247 | confirmado |
| CMD-31 | Aridad: dos argumentos (`ANULA;OP-0001;x;45`, también con dos operaciones inexistentes `ANULA;OP-0001;OP-0002;25` y `ANULA;OP-9999;x;79`) → 400 E302 (gana a E402); cero argumentos (`ANULA;45`) → 400 E302; argumento vacío (`ANULA;;45`) → 400 E104. | 248, 547, 557 (2 args); 546 (0 args); 249 (E104) | confirmado (2 args) / probable (0 args, E104) |

### Aridad de los seis comandos (resumen transversal)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-33 | Aridad esperada: PING 0, ALTA 1, CONSULTA 1, DEPOSITO 2, TRANSFER 3, ANULA 1 argumentos (sin contar el control). Cualquier otro número → 400 `{"error":"E302","mensaje":"aridad inválida"}`, **incluso si además hay una cuenta/operación inexistente, un monto inválido, origen==destino, un monto > 100000 o > saldo** (E302 gana a E303, E401, E402, E304, E506 y E507). Cantidades de argumentos probadas con E302: PING 1 (`PING;64;64`, `PING;1;64`); ALTA 0 y 2; CONSULTA 0, 2 y 3; DEPOSITO 0, 1, 3 y 4; TRANSFER 0, 1, 2 y 4; ANULA 0 y 2. | PING: 67, 68; ALTA: 23, 356, 357; CONSULTA: 139 (0), 544 (2), 545 (3), 554 (2, cuenta inexistente); DEPOSITO: 548 (0), 550 (1), 157 (1), 549 (3, monto `abc`), 553 (3, cuenta inexistente), 561 (1, cuenta inexistente), 159 (4); TRANSFER: 542 (0), 543 (1), 540 y 552 y 555 y 562 (2), 541 y 551 y 556 y 558 y 559 y 560 (4); ANULA: 546 (0), 248 y 547 y 557 (2) | confirmado |

### Comandos desconocidos

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-32 | Cualquier nombre que no sea uno de los seis (con control correcto) → 400 E301 (ERR-9), con cualquier nº de argumentos. Probados `SALDO`, `SALDOS`, `FOO`, `TRANSFERENCIA`, `XYZ`, `QWERTY`, `CONSULTAXYZ123` más los casi-iguales de ERR-9 y ERR-30. No hay barrido de comandos ocultos con nombres lejanos (`HELP`, `RETIRO`, `VERSION`, …): la ausencia de comandos ocultos es un negativo acotado a los nombres probados. | 15, 141, 156, 158, 377, 378, 386, 387, 419, 422, 423, 424 | probable |

**Desconocido**: PING con 2 o más argumentos y cualquier comando con 5 o más (solo se probó hasta 4 en TRANSFER y DEPOSITO);
comportamiento al agotar `AC-9999` / `OP-9999` (máximos vistos: `AC-0017` en el id 361 y `OP-0008` en el id 204); número
máximo de cuentas; formato del saldo en el desbordamiento de JS (`2^53`; el máximo visto es 7553450945 en el id 199, y se
pueden encadenar depósitos de hasta 9999999999 sin tope acumulado, pero no se acercó a 2^53); comandos ocultos con nombres
lejanos (solo se probaron los de CMD-32 y los casi-iguales de ERR-9/ERR-30).

---

## 4. Memoria entre requests

Estado **por token**, en memoria. `POST /__reset` lo vuelve a vacío (MEM-4).

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| MEM-1 | `X-Req`: header de respuesta con un contador por token = nº de `POST /msg` autenticados recibidos (acumulado), **incluidos los que devuelven 400 y el 413** (E100, E101, E102, E104, E201, E202, E301…). Es un string numérico (`"21"`). | 25, 26, 28, 30, 31, 32, 33, 34, 36, 39, 40, 41, 42, 43, 46, 48, 49; 413: 148 (x_req 105), 149 (106) y la serie sigue en 150 (107, un 201); 429 (368), 570-573 (484-487); `POST /msg?x=1`: 612 (519) | confirmado |
| MEM-2 | `/__reset` **no** reinicia `X-Req` (el primer `/msg` tras un reset continúa la cuenta). | 24, 25 (21 tras 1..20); 47, 48 (36); 107, 108 (68); 129, 130 (88); 340 (286); 612, 620 (519 → 520 con el reset 619 en medio); 634, 636 (534 → 535 con el reset 635 en medio) | confirmado |
| MEM-3 | No cuentan ni llevan `X-Req`: `GET /health`, `POST /__reset`, las respuestas 404 y los 401. | 24, 27, 29, 35, 37, 38, 44, 45; 39 (X-Req=30 tras dos 401); 46 (35 tras 404s y health); 567-569 (401), 574-578 (404 y 200 con cuerpo grande), 611, 613 (404), 614, 615 (HEAD), 616-618 (health/reset con query): x_req null | confirmado |
| MEM-4 | `POST /__reset` borra cuentas y operaciones y reinicia los contadores AC y OP: tras él, `ALTA` vuelve a dar `AC-0001` y esa cuenta tiene saldo 0, aunque antes del reset AC-0001 tenía 110000 y existía AC-0002; el primer DEPOSITO vuelve a dar `OP-0001`. | 14 (110000 antes), 108 (AC-0001), 109 (saldo 0), 130, 186 (OP-0001), 236 (OP-0001) | confirmado |
| MEM-5 | Contador de cuentas: `AC-` + 4 dígitos con ceros, secuencial desde `AC-0001` (llega al menos a `AC-0017`). | 6, 7, 108, 130; 340-361 (AC-0001 … AC-0017) | confirmado |
| MEM-6 | Una ALTA rechazada (E202, E302, E104, 413) no consume número de cuenta: tras ellas el siguiente ALTA válido recibe el número que tocaba. | 5, 6; 355-358 (E202, E302, E302, E104) → 359 (AC-0016); 360 (E202) → 361 (AC-0017); 147, 148, 149, 150 (413 entre AC-0001 y AC-0002) | confirmado |
| MEM-7 | Un **único** contador de operaciones `OP-` + 4 dígitos, compartido por DEPOSITO y TRANSFER (en orden de creación). | 9, 10, 13, 21; 186-198 (OP-0001…OP-0007); 214, 228; 236, 237, 250; 256, 257, 264, 271, 272 | confirmado |
| MEM-8 | Los fallos no consumen número de operación: tras E506, E507, E201, E303, E304, E401, E402, E302 y E104, la siguiente operación recibe el número siguiente al último éxito. | 12 → 13; 19, 20 → 21; 200-203 (E303) → 204 (OP-0008 tras OP-0007 en 198); 227 (E506) → 228; 238-249 → 250; 310-334 (E401, E303, E304) → 335 | confirmado |
| MEM-9 | Saldo por cuenta: empieza en 0; DEPOSITO suma; TRANSFER resta del origen y suma al destino; ANULA lo revierte (CMD-26, CMD-27). Las respuestas de CONSULTA, E507 dependen de este saldo. El saldo puede quedar negativo (CMD-28); con saldo negativo todo TRANSFER da E507 y un DEPOSITO suma normal. | 8, 9, 10, 11, 14, 19, 21, 22, 109; 231, 232; 258-262; 335-338; 584-589 | confirmado |
| MEM-10 | Cada operación recuerda si fue anulada: ANULA repetida devuelve `{"ok":false,"motivo":"ya anulada"}` en lugar de `{"ok":true,...}`; la repetición no vuelve a tocar saldos. | 16, 17, 263, 268, 295; 266, 267 (saldos coherentes con una sola aplicación tras la repetición en 263) | confirmado |
| MEM-11 | E506 no depende del historial: es un tope por operación (CMD-18), no acumulado. | 300, 301, 302 (3×100000 seguidas), 303; 398 (120000 en estado fresco, sin transferencias previas, saldo 1000006 → E506) | confirmado |
| MEM-12 | **Sin idempotencia**: mensajes idénticos repetidos crean operaciones distintas (`TRANSFER;AC-0001;AC-0002;100000;12` ×3 → OP-0002, OP-0003, OP-0004). ALTA con el mismo nombre crea cuentas distintas (CMD-7). | 300, 301, 302; 340, 341 | confirmado |
| MEM-13 | Una operación anulada sigue ocupando su número: el contador no retrocede ni reutiliza (OP-0004 tras anular OP-0003, que era la última creada: 269 → 271; OP-0003 tras anular OP-0002, también la última: 652 → 655). | 269, 270, 271; 652, 655 | confirmado |
| MEM-14 | **El estado no caduca con el tiempo** en lo observado: tras 5 minutos sin requests (11:15:31 → 11:20:38) los saldos siguen intactos (700 / 300) y `ANULA` de un DEPOSITO de hace 5 min funciona (200 `{"ok":true,"anulada":"OP-0001"}`, saldo 700 → -300); tras otros 35 minutos sin requests (11:20:40 → 11:50:12) los saldos siguen intactos (-300 / 300), `ANULA` de una TRANSFER de hace 35 min funciona (ambos saldos a 0 / 0) y el contador de operaciones continúa (`OP-0003` tras `OP-0001` y `OP-0002` de hace 35 min). `X-Req` también continúa (543 en el id 644 → 544 en el 645; 548 en el 649 → 549 en el 650), es decir, no hay reset implícito. No hay ventana de anulación ≤ 35 min. | 642-644 (estado base 11:15:30); 645-649 (+5 min); 650-655 (+35 min) | confirmado (acotado a esperas de 5 y 35 min) |

**Desconocido**: aislamiento real entre tokens (no se usó un segundo token); caducidad o ventana de anulación con esperas
mayores de 35 min (solo se probaron 5 y 35 min, MEM-14); si algo sobrevive a `/__reset` aparte de `X-Req`; si
E401/E302/E301 consumen contadores en secuencias con operaciones posteriores más allá de lo de MEM-8; qué ocurre en
`AC-9999`/`OP-9999`.

---

## 5. Errores

Cuerpos exactos (los E-códigos de `/msg` siempre llevan `error` + `mensaje`; acentos UTF-8). Códigos conocidos:
E001, E100, E101, E102, E103, E104, E201, E202, E301, E302, E303, E304, E401, E402, E404, E506, E507.

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| ERR-1 | **E001** · 401 · `{"error":"E001","mensaje":"no autorizado"}` — token ausente, vacío, inválido o con esquema distinto de `Bearer` (ENT-4). | 1, 37, 38, 70, 71, 94, 95, 96, 97, 98, 99, 100, 101, 102, 425, 426, 427, 428; con cuerpo de ≈8300 bytes (401 y no 413): 567, 568, 569 | confirmado |
| ERR-2 | **E404** · 404 · `{"error":"E404","mensaje":"ruta desconocida"}` — ruta o método no soportados (ENT-6). Con `HEAD` el status es el mismo pero el cuerpo es vacío (ENT-9). | 29, 35, 44, 45, 72, 73, 74, 75, 77, 89, 90, 91, 92, 103, 104, 105, 106; 574, 575, 578, 611, 613, 617; HEAD (cuerpo vacío): 93, 614, 615 | confirmado |
| ERR-3 | **E100** · 400 · `{"error":"E100","mensaje":"json inválido"}` — cuerpo no parseable (`xx`) o vacío; también JSON válido seguido de basura, BOM antes del JSON o un formulario real (ENT-17). | 33, 42; 604, 606, 609 | confirmado (`xx`, vacío) / probable (basura final, BOM, formulario) |
| ERR-4 | **E102** · 400 · `{"error":"E102","mensaje":"falta m"}` — JSON válido que no es un objeto con `m` string: objeto sin `m`, `m` no string (`5`, `null`, array), clave `M` en mayúscula, cuerpo `null`, cuerpo string JSON o array JSON (mismo mensaje en todos los casos; ENT-15). | 40, 41, 146; 598, 599, 600, 601, 602 | confirmado |
| ERR-5 | **E103** · 400 · `{"error":"E103","mensaje":"falta control"}` — `m` sin ningún `;` (visto con `PING`, `""` y `"   "`). | 64, 143, 144 | confirmado |
| ERR-6 | **E104** · 400 · `{"error":"E104","mensaje":"segmento vacío"}` — algún segmento vacío (control, comando, argumento intermedio o final). | 54, 65, 66, 87, 112, 183, 249, 358 | confirmado |
| ERR-7 | **E201** · 400 · `{"error":"E201","mensaje":"control mal formado"}` — el último segmento no son 1-2 dígitos (INT-7). | 20, 111, 113-121, 132, 133, 135, 137, 622, 623 | confirmado |
| ERR-8 | **E202** · 400 · `{"error":"E202","mensaje":"control inválido"}` — control bien formado pero distinto del calculado (INT-2 a INT-4). | 5, 31, 79, 80, 81, 82, 86, 110, 123, 125, 128, 131, 134, 136, 138, 140, 152, 355, 360 | confirmado |
| ERR-9 | **E301** · 400 · `{"error":"E301","mensaje":"comando desconocido "}` — **con un espacio final** en `mensaje`. Si el nombre es **casi igual** a un comando conocido (una letra de más, de menos o cambiada, dos letras trasladadas, o espacios/tab de más; sin distinguir mayúsculas), el cuerpo añade `"sugerencia":"<COMANDO canónico en mayúsculas>"`: p. ej. `{"error":"E301","mensaje":"comando desconocido ","sugerencia":"CONSULTA"}`. Con sugerencia: `CONSULT`, `CONSULTAA`, `DEPOSITOO`, `DEPOSIT`, `TRANSFE`, `TRANSFERR`, `ANUL`, `ANULAR`, `PIN`, `PNG`, `PINGG`, `ALTAS`, `ALT`, `LTA`, ` PING`, `PING `, ` ALTA`, `ALTA `, `consulta `, `Consulta `, `CONSULTA<tab>`, ` consulta`, `ping `, `CONSULTA  `, `C ONSULTA`, y además `PONG` (sustitución), `DEPOSTIO` (trasposición), `CONSULTAX`, `CONSLTA`, `TRANSFERS`, `DEPO SITO` (espacio interno), `DEPOSITO `, ` pinG`, `<tab>PING`, `PING  `. Sin sugerencia: `SALDO`, `SALDOS`, `TRANSFERENCIA` (5 letras de más), `XYZ`, `FOO`, ` FOO`, `FOO `, `QWERTY`, `CONSULTAXYZ123`. La regla de "casi igual" (distancia de edición ≤ 2, desempate alfabético) está en ERR-30. | sin sugerencia: 15, 141, 156, 158, 377, 378, 386, 387, 419, 422, 423, 424; con `PING`: 63, 78, 88, 373, 374, 375, 383, 405, 406, 407, 418, 420, 421; con `ALTA`: 83, 84, 376, 388, 389, 408; con `CONSULTA`: 365, 366, 379, 380, 381, 382, 384, 385, 410, 413, 414; con `DEPOSITO`: 367, 368, 409, 415, 416, 417; con `TRANSFER`: 369, 370, 411; con `ANULA`: 371, 372, 412; con salto de línea (`PING\n`, `\nALTA`): 624, 631; repetidos a las 12:00 y 13:00 (` PING;64`, `CONSULT;AC-0001;41`): 670, 671, 708, 709; matriz de ERR-30: 452-471, 564, 566 | confirmado |
| ERR-30 | **Regla de la `sugerencia` de E301** (observada): el nombre se compara en mayúsculas con los seis comandos y se sugiere el comando a **distancia de edición ≤ 2** (inserción, borrado, sustitución; una trasposición adyacente cuenta y sugiere); a distancia 3 o más no hay `sugerencia`. El corte es **absoluto**, no proporcional al largo: la sustitución de 2 letras sugiere en los seis comandos (`XXNG`→PING, `XXTA`→ALTA, `XXNSULTA`→CONSULTA, `XXPOSITO`→DEPOSITO, `XXANSFER`→TRANSFER, `XXULA`→ANULA) y la de 3 no sugiere en ninguno (`XXXG`, `XXXA`, `XXXSULTA`, `XXXOSITO`, `XXXNSFER`, `XXXLA`), ni la de 4 (`XXXX`, `XXXXULTA`). Trasposiciones adyacentes que sí sugieren: `PIGN`, `ATLA`, `CONUSLTA`, `TRANSEFR`, `DEPOSTIO`. Esto descarta la métrica "Damerau con tope 1" (una sustitución doble sugiere). **Empates** (misma distancia mínima a dos comandos): gana el primero por orden alfabético (ALTA < ANULA < CONSULTA < DEPOSITO < PING < TRANSFER): `ANLUA`→ALTA (empate con ANULA), `ALNG`→ALTA (con PING), `ONSULA`→ANULA (con CONSULTA), `CNULTA`→ANULA (con CONSULTA). También a distancia 3 (mezcla de borrado y sustituciones) `SALDO`→ALTA no sugiere (377), y las inserciones largas (`TRANSFERENCIA`, `CONSULTAXYZ123`) tampoco. Sin probar: distancia exactamente 3 por inserciones o borrados puros (`CONSULTAXYZ`, `CONSULTAXY`), si es Levenshtein o Damerau ≤ 2 (hace falta una trasposición más otra edición), y empates que involucren DEPOSITO o TRANSFER. | sugiere a distancia 2: 452-462 (452 `PIGN`, 453 `ATLA`, 454 `CONUSLTA`, 455 `TRANSEFR`, 456 `ANLUA`, 457-462 sustituciones dobles), 409; no sugiere a distancia 3 y 4: 463-470, 377 (`SALDO`), 386 (`TRANSFERENCIA`), 424 (`CONSULTAXYZ123`); empates: 456, 471, 564, 566 | confirmado (corte en distancia 2 por sustitución y trasposición) / probable (desempate alfabético: 4 muestras, todas con ALTA o ANULA ganando; también compatible con otro orden interno) |
| ERR-10 | **E302** · 400 · `{"error":"E302","mensaje":"aridad inválida"}` — nº de argumentos distinto del esperado (tabla completa en CMD-33: PING con 1 argumento de más; ALTA con 0 y 2; CONSULTA con 0, 2 y 3; DEPOSITO con 0, 1, 3 y 4; TRANSFER con 0, 1, 2 y 4; ANULA con 0 y 2). Gana a E303, E401, E402, E304, E506 y E507 (ERR-29). | 23, 67, 68, 139, 157, 159, 248, 356, 357; 540-562 | confirmado |
| ERR-11 | **E401** · 404 · `{"error":"E401","mensaje":"cuenta inexistente"}` — cuenta no existente o id mal formado, en CONSULTA, DEPOSITO y TRANSFER (origen o destino). | 18, 124, 126, 127, 310, 312-321, 322, 324, 325, 326, 331, 332, 363, 632 | confirmado |
| ERR-12 | **E506** · 422 · `{"error":"E506","mensaje":"límite excedido"}` — TRANSFER con monto > 100000 (CMD-18). | 12, 227, 303 | confirmado |
| ERR-13 | **E507** · 422 · `{"error":"E507","mensaje":"saldo insuficiente"}` — TRANSFER con monto ≤ 100000 y > saldo del origen (CMD-19); un saldo negativo cuenta como insuficiente. | 19, 229, 230, 338, 587, 594 | confirmado |
| ERR-14 | Fallo "blando" de ANULA: **200** `{"ok":false,"motivo":"ya anulada"}` (no es E-código). | 17, 263, 268, 295 | confirmado |
| ERR-15 | **Orden 1-2**: ruteo (ruta+método → E404) antes que autenticación (E001). Un 404 gana contra un 401 con o sin token válido. | 69, 72, 73, 89, 90, 91, 92, 103, 104, 105, 106 | confirmado |
| ERR-16 | **Orden 2-3**: autenticación (E001) antes que el cuerpo: cuerpo válido o no-JSON sin token → 401, nunca E100/E102. Luego E100 (no parsea) y E102 (parsea pero falta `m` string). | 71, 94 (401 primero); 33, 42 (E100); 40, 41, 146 (E102) | confirmado |
| ERR-17 | **Orden 4**: estructura del mensaje (E103 sin `;`; E104 segmento vacío) antes que cualquier error de control; p. ej. `CONSULTA;AC-0001;` es E104, no E201; el monto vacío es E104, no E303. | 112, 54, 65, 87, 183 | confirmado |
| ERR-18 | **Orden 5-6**: forma del control (E201) y valor del control (E202) se evalúan antes que E301, E302 y E401. Un mensaje con dos fallos devuelve el error de control: `SALDOS` (E301) con control malo → E202/E201; `ALTA` con aridad mala → E202/E201; `CONSULTA` con cuenta inexistente → E202/E201; `CONSULTA` con aridad mala → E202. Con el control correcto aparece el segundo error. | E202/E201 ganan: 131, 132, 134, 135, 136, 137, 138, 140; con control correcto: 15, 141 (E301), 23, 139 (E302), 18 (E401) | confirmado |
| ERR-19 | **PING**: sale de la tubería sin pasar por E201/E202 (pong aunque el control sea basura), pero sí pasa por E103/E104 y por E302. | 49-53, 55-62 (pong); 54, 64, 65, 66 (E103/E104); 67, 68 (E302) | confirmado |
| ERR-20 | Para comandos desconocidos el control se valida antes que E301 (ERR-18/INT-13): `PIN;64`, `PONG;64`, `SALDO;AC-0001;1` dan E202, no E301. | 79, 81, 86 | confirmado |
| ERR-21 | **E101** · 413 · `{"error":"E101","mensaje":"cuerpo demasiado grande"}` — cuerpo crudo de `POST /msg` de más de 8192 bytes, sea JSON válido, no JSON, objeto sin `m` o con `m` no string (ENT-14). Cuenta para `X-Req`. | 148, 149, 429, 486, 487, 489, 495, 497, 499, 501, 503, 513; sin JSON / sin `m` / `m`=5 / `m` válido + clave extra: 570, 571, 572, 573; repetido a las 12:00 y 13:00: 672, 710 | confirmado |
| ERR-22 | **E301 antes que E302**: un comando desconocido nunca da E302, aunque tenga cualquier nº de argumentos (control correcto). | 156, 158, 141, 373 | confirmado |
| ERR-23 | **E303** · 400 · `{"error":"E303","mensaje":"monto inválido"}` — monto de DEPOSITO/TRANSFER que no es un entero canónico de 1-10 dígitos > 0 (INT-16). | 162-182, 200-203, 205-210, 215-226, 311, 323, 330, 633, 634 | confirmado |
| ERR-24 | **E304** · 400 · `{"error":"E304","mensaje":"origen y destino iguales"}` — TRANSFER con origen == destino, también cuando esa cuenta no existe (`TRANSFER;AC-0009;AC-0009;100;<ctrl>` → E304, no E401; una sola muestra de ese caso). | 327, 328, 329; 473 (cuenta inexistente) | confirmado (cuenta existente) / probable (cuenta inexistente) |
| ERR-25 | **E402** · 404 · `{"error":"E402","mensaje":"operación inexistente"}` (con acento) — ANULA de una operación inexistente o con id mal formado (INT-17). | 238-247 | confirmado |
| ERR-26 | **Orden de negocio, parte 1**: E303 (monto) antes que E401 y que E304: `DEPOSITO;AC-0009;abc` y `TRANSFER;AC-0009;AC-0002;abc` → E303 aunque la cuenta no exista; `TRANSFER` AC-0001→AC-0001 con monto 0 → E303. E303 también gana a E506/E507 con montos de 11 dígitos. | 311, 323, 330; 226 (11 dígitos en TRANSFER → E303, no E506) | confirmado (E401/E304) / probable (E506/E507) |
| ERR-27 | **Orden de negocio, parte 2**: E401 y E304 antes que E506 y E507. `TRANSFER` a cuenta inexistente con monto > 100000 → E401; con monto > saldo → E401; origen==destino con monto > 100000 o > saldo → E304. | E401: 324, 326 (> 100000), 325 (> saldo); E304: 328 (> saldo), 329 (> 100000) | confirmado |
| ERR-28 | **Orden de negocio, parte 3**: E506 antes que E507: monto 9999999999 con saldo 5000 → E506. | 227 | probable |
| ERR-29 | Pipeline completo observado (de primero a último): E404 → E001 → E101 → E100/E102 → E103/E104 → [PING: pong o E302] → E201 → E202 → E301 → E302 → E303 → E304 → E401 → E506 → E507. ANULA: ... → E302 → E402 → ejecución. E404 gana a E101 (ruta desconocida con cuerpo gigante → 404). E001 gana a E101 (sin token o token inválido con cuerpo gigante → 401). E101 se mide sobre el cuerpo crudo antes de parsear, por lo que gana a E100 y E102. `GET /health` y `POST /__reset` no aplican el límite de tamaño. E302 (aridad) gana a E303, E401, E402, E304, E506 y E507 en DEPOSITO, CONSULTA, TRANSFER y ANULA. E304 gana a E401: `TRANSFER;AC-0009;AC-0009;100` (misma cuenta inexistente) → E304. | E404>E101: 574, 575, 578; E001>E101: 567-569; E101>E100/E102: 570-573; sin límite: 576, 577; E302 gana: 540-562; E304>E401: 473; resto: ERR-15 a ERR-18, ERR-22, ERR-26 a ERR-28 | confirmado, salvo los eslabones con una sola muestra, que son probable: E101>E100 (570; E101>E102 tiene tres: 571, 572, 573), E304>E401 con cuenta inexistente (473), E506>E507 (227, ERR-28) y E202>E303 (inferido por transitividad, INT-14) |

**Resuelto desde la versión anterior de esta spec**: orden de E101 frente a E001, E100, E102 y E404 (ids 567-578); E302 frente a
E303/E401/E402/E304/E506/E507 (540-562); E304 frente a E401 con la misma cuenta inexistente (473; con aridad mala gana E302, 562);
E402 frente a E302 (547, 557); E102 con `m` null (599).

**Desconocido (orden no probado)**: E103 y E104 frente a E302/E202 en mensajes de comandos no-PING con más de un fallo a la
vez (p. ej. segmento vacío más aridad mala); E101 frente a `Authorization` con esquema distinto de `Bearer` (solo se probó sin
token y con token inventado, 567-569); códigos E5xx por debajo de 506 (E501-E505) y superiores a
507, E003 y similares: no se encontraron, pero tampoco se barrieron (montos inválidos dan E303, cuentas inexistentes E401,
ids de operación E402: no hay negativo acotado).

---

## 6. Cambios durante el día

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CAM-1 | **Canario**: los 20 requests de la versión de la mañana, reproducidos en orden tras un `/__reset`, dan status y cuerpo idénticos a los de la primera corrida (0 diferencias) en las **cinco** corridas del log (horas en -0500, 2026-10-10): (1) ids 3 (reset) y 4-23, hora no registrada (anterior al id 339, que es el primero con `ts`); (2) ids 430 (reset) y 431-450, 10:54:52-10:54:59; (3) ids 516 (reset) y 517-536, 11:09:14-11:09:21; (4) ids 673 (reset) y 674-693, 12:00:07-12:00:14; (5) ids 711 (reset) y 712-731, 13:00:07-13:00:14. El diff se hizo línea a línea (status y cuerpo de cada una de las 20 respuestas contra 4-23) al revisar esta spec, leyendo el log; no es la salida de un script del repo. No se detectó ningún cambio de versión entre la mañana y las 13:00:14. | corrida 1: 3, 4-23 (conclusiones en 4 y 23); corrida 2: 430-450; corrida 3: 516-536; corrida 4: 673-693; corrida 5: 711-731 | confirmado (cinco corridas sin diferencias; el log no cubre de 13:00:14 a 20:00) |
| CAM-2 | Mensajes repetidos en momentos distintos del día dieron la misma respuesta: `PING;64`, `ALTA;Lucia;83` (E202), `ALTA;Lucia;82` (201 `AC-0001`), `CONSULTA;AC-0001;14` (saldo 0), `SALDOS;AC-0001;38` (E301 sin sugerencia), `TRANSFER;AC-0001;AC-0002;100000;12` (200). Hasta el id 731 (13:00:14) no se detectó ningún cambio de versión. | `PING;64`: 4, 25, 48, 431, 517, 674, 712; E202: 5, 31, 432, 518, 675, 713; ALTA: 6, 108, 130, 155, 340, 433, 519, 676, 714; CONSULTA: 8, 109, 435, 521, 678, 716; SALDOS: 15, 378, 442, 528, 685, 723 (378 y 442 con `ts` 10:53:56 y 10:54:56); TRANSFER 100000: 13, 300, 440, 526, 683, 721; E506 120000: 12, 398, 439, 525, 682, 720 | confirmado |
| CAM-3 | El log guarda marca de tiempo (`ts`, hora local -0500) **solo desde el id 339** (2026-10-10T10:53:31). Antes de eso no se puede fechar un cambio, solo ordenarlo por `id`. | 338 (sin `ts`), 339 (con `ts`) | confirmado |
| CAM-4 | Los ejemplos de la mañana no distinguen la fórmula `98-(100N mod 97)` de `1-3N mod 97` (solo difieren cuando `3N mod 97` es 0 o 1); el desempate (ids 123-126) se hizo después de la línea base (4-23), así que no hay una versión anterior con la que compararlo. Los seis bordes 123-128 se re-ejecutaron a las 12:00 y a las 13:00 con el mismo resultado (CAM-5): no se vio divergencia, pero tampoco hay un punto previo al desempate. Si el control de las 20:00 fuera otro, 123-128 son los primeros puntos a re-ejecutar. | 4-23 (compatibles con ambas), 123-126 (solo C2); re-ejecuciones: 664-669 (12:00), 702-707 (13:00) | probable |
| CAM-5 | **Vigía ampliado** (más puntos que el canario de 20), dos corridas con resultados idénticos entre sí y consistentes con lo observado antes: (a) ids 656 (reset) y 657-672, 12:00:01-12:00:06; (b) ids 694 (reset) y 695-710, 13:00:01-13:00:07. Contenido y resultado: `TRANSFER;AC-0001;AC-0002;100001;9` → 422 E506 (como 303); `DEPOSITO;AC-0001;9999999999;4` → 200 `recieved` (como 204); `DEPOSITO;AC-0001;10000000000;63` → 400 E303 (como 209); los seis bordes del control `CONSULTA;AC-0038;0` E202, `;97` E401, `AC-0070;1` E202, `;98` E401, `AC-0005;2` E401, `;99` E202 (como 123-128); `" PING;64"` → E301 con `sugerencia` PING (como 63); `CONSULT;AC-0001;41` → E301 con `sugerencia` CONSULTA (como 365); `ALTA;` + más de 8300 `A` → 413 E101 (como 429). Mismos `ALTA`/`DEPOSITO`/`TRANSFER` iniciales: `AC-0001`, `AC-0002`, `OP-0001`, `OP-0002`. | (a) 657-672, (b) 695-710; referencias: 303, 204, 209, 123-128, 63, 365, 429 | confirmado (sin cambios entre 12:00, 13:00 y las pruebas de la mañana) |

**Cómo se detectó (y qué falta)**: se repite el canario y el vigía tras un `/__reset` y se compara status y cuerpo de cada
respuesta contra la línea base (ids 4-23 y las referencias de CAM-5); cualquier diferencia sería un candidato a cambio, no su
causa. Entre la mañana (≈10:53) y las 13:00:14 no hay ninguna diferencia (CAM-1, CAM-2, CAM-5). **Desconocido**: si el servicio
cambia entre las 13:00:14 y las 20:00 (la última línea del log es el id 731); qué puede cambiar (mensajes, tope de E506,
fórmula, comandos nuevos, códigos de estado); el canario y el vigía solo cubren los 20 mensajes y los puntos de CAM-5, no
todos los comportamientos de esta spec, así que un cambio fuera de esos puntos pasaría inadvertido.

---

## 7. Riesgos

Comportamientos del original que un cliente nuevo no debería heredar, y cómo cerrarlos. (El reemplazo de este reto **sí**
debe reproducirlos; esta sección es lo que haríamos en un servicio nuevo.)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| RIE-1 | **PING no valida el control** y acepta basura (`PING;XX`, `PING;-1`): inconsistente con los demás comandos. Cierre: validar el control en todos los comandos, PING incluido. | 49-53, 55-62 vs 111 | confirmado |
| RIE-2 | **El control es un checksum público sin secreto**: cualquiera puede calcularlo (INT-2), así que no autentica ni protege la integridad contra un atacante, solo contra errores de tecleo. Cierre: HMAC con clave por cliente. | 4-23, 123-128 (la fórmula es determinista y reproducible desde el log) | probable |
| RIE-3 | **Typo en el contrato**: `"status":"recieved"` en DEPOSITO y TRANSFER. Un cliente que compare contra `received` fallará. Cierre: versionar la API y corregir. | 9, 10 | confirmado |
| RIE-4 | **Claves inconsistentes** entre respuestas: `cuentaId` (ALTA), `cuenta_id` (CONSULTA), `operacionId` (DEPOSITO/TRANSFER). Cierre: un solo estilo. | 6, 8, 9 | confirmado |
| RIE-5 | **Espacio final en `mensaje` de E301** (`"comando desconocido "`), y campo extra `sugerencia` solo en algunos E301 (nombres casi iguales a un comando): un cliente que compare strings o valide el esquema se rompe. Cierre: mensajes sin espacio sobrante y esquema estable. | 15, 63, 141, 365, 377 | confirmado |
| RIE-6 | **Fallos de negocio con status 200**: `ANULA` repetida devuelve 200 `{"ok":false,"motivo":"ya anulada"}`, mientras los demás fallos son 4xx. Un cliente que mire solo el status cree que funcionó. Cierre: 409 con E-código. | 17, 263 | confirmado |
| RIE-7 | **DEPOSITO/TRANSFER responden `recieved` pero el efecto es inmediato y síncrono** (la consulta siguiente ya ve el saldo): el nombre sugiere asincronía que no existe. Cierre: nombrar el estado real (`applied`). | 9, 14, 21, 22, 186, 187 | confirmado |
| RIE-8 | **`/health` exige token**: un balanceador o monitor sin credenciales recibe 401 y marca el servicio caído. Cierre: `/health` público o con credencial de infraestructura. | 1, 2, 95, 96 | confirmado |
| RIE-9 | **404 genérico para método incorrecto** (GET /msg, POST /health, PUT /msg…): no hay 405 ni `Allow`; el cliente no sabe si la ruta existe. Además `HEAD` responde 404 con cuerpo vacío, también sobre `/health` y `/msg` con token válido: un monitor que use `HEAD /health` ve 404 y cree que el servicio no existe. Cierre: 405 + `Allow`, y `HEAD` igual que `GET` sin cuerpo. | 35, 44, 45, 89-92, 93, 614, 615 | confirmado |
| RIE-10 | **Estado solo en memoria y borrable con un único request** (`POST /__reset` con el token): un reinicio o un reset accidental pierde todas las cuentas y operaciones sin rastro, y los contadores AC/OP vuelven a 1 (ids reutilizados). Cierre: persistencia + auditoría, y `/__reset` solo en entornos de prueba. | 3, 14, 108, 109 | confirmado |
| RIE-11 | **Errores de validación (400) y el 413 consumen cuota y `X-Req`** igual que los éxitos, y el contador `X-Req` no se reinicia ni se separa por resultado: sirve mal para auditoría. Cierre: contar éxitos y fallos por separado. | 31, 33, 40, 41, 42, 46, 148; 570-573 (413 con `X-Req` 484-487) | confirmado |
| RIE-12 | **El tope de TRANSFER (100000 por operación) no se informa en el error** (`límite excedido` sin el valor) y DEPOSITO no tiene tope: se puede ingresar hasta 9.999.999.999 en una operación. Cierre: error con el tope aplicable y topes simétricos. | 12, 303 (E506); 204 (DEPOSITO 9999999999 aceptado) | confirmado |
| RIE-13 | **Ambigüedad del control**: `CONSULTA;AC-0038;0` se rechaza y `;97` se acepta (rango 2..98, no 0..96): un cliente que implemente `1-3N mod 97` falla cuando `3N mod 97` vale 0 o 1 (≈ 2 de cada 97 payloads, cifra inferida). Cierre: especificar la fórmula y los vectores de prueba. | 123, 124, 125, 126 | confirmado |
| RIE-14 | **Control con cero inicial inconsistente**: `014`/`0014` se rechazan por forma (E201) pero `02`/`03` pasan la forma y se rechazan por valor (E202); la comparación es textual, no numérica. Un cliente que normalice `02`→`2` fallará. Cierre: una sola regla (forma canónica o comparación numérica). | 114, 115, 152, 153, 360 | confirmado |
| RIE-15 | **El tope por operación se elude fraccionando**: no se observó tope acumulado (3×100000 pasan seguidas) y los depósitos no tienen tope (CMD-13); el log no probó ningún límite de frecuencia del servicio. Cierre: tope diario/acumulado por cuenta. | 300, 301, 302 | confirmado |
| RIE-16 | **ANULA puede dejar saldos negativos** (no comprueba fondos): ni del destino de una TRANSFER (-500) ni del titular de un DEPOSITO ya gastado (-900, -300), y no hay ventana de tiempo para anular (se anuló un depósito a los 5 min y una transferencia a los 35 min, MEM-14). Una cuenta en negativo no puede transferir nada (E507). Cierre: rechazar la anulación (E507) o exigir fondos / bloquear, y poner una ventana de anulación. | 283, 285, 289; 584, 585, 587; 647, 648, 652 | confirmado |
| RIE-17 | **Sin validación del nombre en ALTA**: acepta nombres vacíos de contenido (`"   "`), duplicados exactos, caracteres arbitrarios y nombres de miles de caracteres (hasta el 413). Cierre: validar longitud y caracteres, rechazar duplicados. | 340, 341, 351, 354, 147, 150 | confirmado |
| RIE-18 | **E301 con `sugerencia` permite enumerar comandos válidos** por ensayo y error: cada typo cercano devuelve el nombre exacto. Cierre: no devolver sugerencias en producción. | 365-376, 388, 389, 405-418; regla en ERR-30: 452-471 | confirmado |
| RIE-19 | **Lectura permisiva y ambigua del cuerpo**: el `Content-Type` se ignora (607, 608, 610) y con la clave `m` duplicada gana la última (603): dos componentes que lean el mismo cuerpo de forma distinta (un proxy que se quede con la primera `m`) podrían validar un mensaje y ejecutar otro. Cierre: exigir `application/json`, rechazar claves duplicadas y cuerpos con basura final. | 603, 607, 608, 610 | probable (`m` duplicada: una muestra) |
| RIE-20 | **El estado no caduca ni se audita**: operaciones de hace 35 minutos siguen siendo anulables y los saldos no cambian con el tiempo; junto con RIE-16 permite cambiar el saldo de una cuenta mucho después de la operación, y ninguno de los seis comandos devuelve un historial. Cierre: ventana de anulación, registro de auditoría y contra-asiento en lugar de revertir. | 645-655 | confirmado (acotado a esperas de 5 y 35 min) |

---

## Preguntas abiertas (prioridad para recon-prober y fuzzer)

Estado al id 731 (2026-10-10T13:00:14-0500). Las preguntas de esta lista no tienen respuesta en el log; las ya contestadas están
en las tablas (la versión anterior de esta lista, al id 450, preguntaba por aridad restante, E304 vs E401, umbral del 413, ANULA de un
DEPOSITO gastado, `null`/`{"m":null}`/`{"M":...}`/formulario, `/msg/`, `/MSG`, `/msg?x=1`, `Content-Type`, `HEAD` con token y
espera de 5 min: todo eso ya está respondido en ENT-9, ENT-14 a ENT-20, CMD-28, CMD-33, MEM-14 y ERR-29). P0 afecta a casi todos los
tests del set (40 son de un solo request).

### P0

1. **Canario horario de las 14:00 a las 20:00** (recon-prober, con `ts`): repetir los 20 mensajes (CAM-1) y el vigía de CAM-5 cada hora;
   el log termina en 13:00:14 y lo que cuenta es la versión de las 20:00.
2. **Comandos ocultos** (fuzzer): barrido de nombres lejanos (`HELP`, `VERSION`, `ECHO`, `RESET`, `ADMIN`, `RETIRO`…) con control
   correcto. Todo lo que no sea E301 es hallazgo. Hoy solo hay un negativo acotado (CMD-32).
3. **Un fallo de estructura más otro fallo** en comandos no-PING: E104 frente a E302/E202 (`ALTA;;;85`, `TRANSFER;AC-0001;;10;<ctrl>`,
   `CONSULTA;;<ctrl malo>`), E103 con `CONSULTA` y `ALTA` sin `;`, y el orden directo E202 frente a E303 (monto inválido con control malo).
4. **Regla de la `sugerencia`** (fuzzer): distancia exactamente 3 por inserción o borrado puros (`CONSULTAXYZ`), si es Levenshtein o
   Damerau ≤ 2 (trasposición más otra edición, p. ej. `PIGNX`), y desempates con DEPOSITO y TRANSFER (ERR-30).

### P1

5. **Rollover**: `AC-9999`/`OP-9999` (¿5 dígitos?, ¿error?) y límite de cuentas; saldos cerca de 2^53; muchos depósitos grandes (máximos vistos:
   `AC-0017`, `OP-0008`, saldo 7553450945).
6. **Controles de 3+ dígitos** distintos de `014`/`0014`/`111` (`100`, `198`), `00`, `05`, dígitos Unicode en el control, y `ping;00` en minúscula.
7. **Cuerpo y auth**: cuerpo JSON `5`/`true`, UTF-8 inválido, `Content-Length` inconsistente; esquema `BEARER`, doble espacio, token sin esquema;
   `HEAD` sobre `/__reset` y rutas inexistentes, `OPTIONS`/`PUT` sobre `/health` y `/__reset` con token.
8. **Pesos de otros caracteres en el control**: `/`, `#`, `€`, NBSP y otros espacios Unicode (INT-15 solo cubre los listados allí).

### P2

9. **Aislamiento entre tokens** (necesita un segundo token) y rate-limit (`X-Frontier-Infra`, 10 req/s, 8000/día): nunca observados.
10. **Esperas largas**: más de 35 min entre DEPOSITO y ANULA y entre requests (MEM-14 solo cubre 5 y 35 min).
11. **Barrido de códigos E5xx** (E501-E505, E508+) y E003 y similares: no se han buscado.

---

## Cierre (relectura del log)

Última lectura del log: ids 1-731 (731 líneas; último `ts` 2026-10-10T13:00:14-0500). En esta revisión se releyeron completos los ids
451-731 (request, status, response, `x_req` y conclusión de cada línea) y se releyeron de nuevo el request, status, cuerpo y
`x_req` de todos los ids 1-450 (vista compacta, sin hipótesis ni conclusiones salvo las filas que las necesitaban: 75, 77, 89-93,
105, 106, 426-428). Verificados además a mano sobre la línea del log: los tamaños de cuerpo
de los ids 503 (8193 bytes) y 511 (8192 bytes) y el contenido de 513 (60 `ñ`) y 515 (1 `ñ`); las demás cifras de bytes de ENT-14 son
las de la conclusión de cada línea. Ids cuyo cuerpo crudo no se puede leer del campo `request` por ser JSON no objeto (598, 601): ninguna línea del log guarda un campo
`body_raw`, así que el cuerpo se toma de su `hipotesis`/`conclusion` (`null` y `"PING;64"`); la clave duplicada del id 603 también
se toma de su `hipotesis`, porque el log guarda el objeto ya decodificado.
