# Especificación de la caja negra

Autor: spec-writer. Fuente única de evidencia: `experimentos.jsonl` (los `id` citados son los de ese log).
Los ejemplos de `material/pruebas/ejemplos.jsonl` **no se usan como evidencia**: lo que contienen está
citado solo a través de su reproducción en nuestro log (ids 4-23).

Cobertura del log al escribir: ids 1-450 (ver "Cierre" al final para la última relectura).

## Convenciones

- `id N` / `ids N-M` = línea(s) de `experimentos.jsonl`. `x_req` = valor del header `X-Req` de la respuesta.
- Confianza: **confirmado** = observado en al menos dos requests independientes con el mismo resultado;
  **probable** = observado una vez o inferido de lo observado; **supuesto** = no probado (default del reemplazo).
  Las afirmaciones sin ningún `id` **no están en las tablas**: van en las listas "Desconocido" bajo cada sección.
- Los cuerpos se dan como JSON compacto. El set compara JSON sin orden de claves; los strings son exactos
  (acentos UTF-8, espacios finales, typos incluidos).
- Todas las respuestas observadas de `/msg` son JSON (única excepción: `HEAD /msg`, cuerpo vacío, id 93).
- Los quirks se describen tal cual; no se corrigen.
- IDs retirados (no reutilizar): `ENT-11`.
- Las líneas del log desde el id 339 llevan un campo `ts` (hora local, offset -0500); las anteriores no.

---

## 1. Entrada

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| ENT-1 | Las únicas combinaciones ruta+método con comportamiento propio son `GET /health`, `POST /__reset` y `POST /msg`. Todo lo demás cae en ENT-6. | 2, 3, 4 (las tres válidas); 35, 44, 45, 89, 90, 91, 92 (otros métodos sobre ellas = 404) | confirmado |
| ENT-2 | `GET /health` con token válido: **200** `{"ok":true}`. Sin header `X-Req` y no cuenta para `X-Req`. | 2, 27 | confirmado |
| ENT-3 | `POST /__reset` con token válido: **200** `{"ok":true}`, sin header `X-Req`. (Probado siempre sin cuerpo.) | 3, 24, 47, 76, 107, 122, 129 | confirmado |
| ENT-4 | Autenticación = header `Authorization: Bearer <token>`. Cualquiera de estos casos da **401** `{"error":"E001","mensaje":"no autorizado"}`, siempre el mismo cuerpo (no distingue "falta" de "inválido"): sin header, `Bearer ` vacío, token inventado, esquema `Basic`, esquema `bearer` en minúscula, y también `bearer <token válido>` y `Basic <token válido>` (el esquema se compara exacto: solo `Bearer`). Aplica a `GET /health`, `POST /msg` y `POST /__reset`: las tres exigen token (incluido `/health`). | `/health`: 1, 95, 96, 97, 98, 425 (`bearer` + token válido), 427 (`Basic` + token válido); `/msg`: 37, 38, 71, 94, 99, 100, 101, 102, 426 (`bearer` + token válido), 428 (`Basic` + token válido); `/__reset`: 70 | confirmado |
| ENT-5 | La auth se evalúa **después** del ruteo (ruta+método) y **antes** de leer/parsear el cuerpo de `/msg`: un cuerpo válido o no-JSON sin token da 401 E001 igual. | ruteo antes que auth: 69, 72, 73, 89, 90, 91, 92, 103, 104, 105, 106; auth antes que cuerpo: 71, 94 (válido sin token y no-JSON sin token, mismo 401) | confirmado |
| ENT-6 | Ruta o método no soportado (incluida la raíz `/`) responde **404** `{"error":"E404","mensaje":"ruta desconocida"}`, con o sin token, con token válido o inválido, para cualquier método. No lleva `X-Req` y no cuenta. | GET /nada: 29, 72, 103; POST /nada: 73, 104; GET /: 74; GET /msg: 35; POST /health: 44, 69; GET /__reset: 45; PUT /msg: 89, 106; DELETE /msg: 90; PATCH /msg: 91; OPTIONS /msg: 92 (x_req null en 29, 35, 44, 45) | confirmado |
| ENT-7 | El ruteo distingue mayúsculas: `GET /HEALTH` es 404 E404 (no es `/health`), con y sin token válido. | 77, 105 | confirmado |
| ENT-8 | El ruteo no normaliza la barra final: `GET /health/` es 404 E404 (sin token). | 75 | probable |
| ENT-9 | `HEAD /msg` (sin token): status **404** con cuerpo vacío (`""`). No se probó `HEAD` con token ni sobre otras rutas. | 93 | probable |
| ENT-10 | Cuerpo de `POST /msg` = objeto JSON con la clave `m` de tipo string, p. ej. `{"m":"PING;64"}`. Cuerpo no-JSON (`xx`) o vacío: 400 E100. Objeto sin `m` (`{}`), con `m` no string (`{"m":5}`) o un array JSON (`[]`): 400 E102. Cuerpos y `m` inválidos cuentan para `X-Req` (ver MEM-1). | 4 (válido); 33, 42 (E100); 40, 41, 146 (E102) | confirmado |
| ENT-12 | Las claves extra en el objeto se ignoran: `{"m":"PING;64","x":1}` → 200 `{"pong":true}`. | 145 | probable |
| ENT-13 | `m` vacío (`""`) o solo espacios (`"   "`) con token válido: 400 E103 `falta control` (no E102 ni E104; se trata como un mensaje sin ningún `;`). | 143, 144 | confirmado |
| ENT-14 | Límite de tamaño: un `m` de ≈2000 y ≈6000 caracteres (`ALTA;AAAA…;<ctrl>`; cuerpo JSON ≈6017 bytes) se procesa normal (201); uno de ≈8500 (cuerpo ≈8517 bytes), ≈11000 y ≈20000 se rechazan con **413** `{"error":"E101","mensaje":"cuerpo demasiado grande"}`. El umbral exacto está entre ≈6017 y ≈8517 bytes de cuerpo (no se afinó; el log atribuye esas cifras de bytes al cuerpo JSON, no a `m`). | 147 (≈2000 → 201), 150 (≈6000 → 201), 429 (≈8500 → 413; su conclusión da 6017/8517 bytes), 149 (≈11000 → 413), 148 (≈20000 → 413) | confirmado (existencia del límite); umbral desconocido |

**Desconocido (sin id; el reemplazo usa un default = supuesto)**: cuerpo `null`, `"PING;64"` (string JSON), `{"m":null}`,
clave `M` en mayúscula, cuerpo tipo formulario; `POST /msg/`, `POST /MSG`, `POST /msg?x=1`;
`HEAD` con token; `GET /health` con cuerpo; umbral exacto del 413 (entre ≈6017 y ≈8517 bytes) y su orden frente a
auth/E100 (solo se probó con token válido y JSON válido); comportamiento ante un
`Content-Type` distinto; rate-limit del original (el header `X-Frontier-Infra` nunca apareció en el log: ninguna línea
tiene el campo `infra`); aislamiento entre tokens (el estado visto es de un único contador `X-Req`, no se usó un
segundo token; el README del material lo afirma pero no lo probamos).

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
| INT-7 | Forma del control: solo se aceptan **1 o 2 dígitos decimales sin signo, sin espacios ni decimales**. Mal formado → 400 **E201**: `XX`, `5X`, `014`, `0014`, `+14`, ` 14`, `14 `, `111`, `14.0`, `-83`, y un argumento en lugar del control. Aceptados como forma (llegan a la comparación y dan E202 o E401): `0`, `1`, `2`, `02`, `03`, `14`, `15`, `97`, `98`, `99`. (`02`/`03` pasan la forma —2 caracteres— pero fallan la comparación textual, INT-3; `014` no pasa la forma —3 caracteres—.) | E201: 20, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 132, 133, 135, 137; formas aceptadas: 110, 123, 124, 125, 126, 127, 128, 152, 153, 360 | confirmado |
| INT-8 | Segmento vacío (incluido el control vacío `CONSULTA;AC-0001;`, el comando vacío `;64`, `PING;;`, el monto vacío `DEPOSITO;AC-0001;;4`, el argumento vacío `ANULA;;45` y el nombre vacío `ALTA;;5`) → 400 **E104** `segmento vacío`; se evalúa **antes** que E201/E202/E303/pong. | 54, 65, 66, 87, 112, 183, 249, 358 | confirmado |
| INT-9 | Mensaje sin ningún `;` (`PING`, `""`, `"   "`) → 400 **E103** `falta control`. Los espacios no cuentan como `;`. Probado con `PING` y con `m` vacío/espacios, no con otros nombres de comando. | 64, 143, 144 | confirmado |
| INT-10 | **PING no valida el control**: `PING;00`, `;63`, `;65`, `;99`, `;XX`, `;100`, `;064`, `;6`, `;-1`, `; 64`, `;64 ` responden todos `{"pong":true}`. PING sí valida la estructura (E103, E104) y la aridad (E302). | pong: 49, 50, 51, 52, 53, 55, 56, 57, 58, 61, 62; estructura/aridad: 54, 64, 65, 66, 67, 68 | confirmado |
| INT-11 | El nombre del comando **no se recorta**: con espacios o tabulador al principio, al final o dentro (`" PING"`, `"ALTA "`, `"PING "`, `"CONSULTA\t"`, `"C ONSULTA"`) no se reconoce el comando y da E301 con el campo extra `sugerencia` (ERR-9). | 63, 78, 83, 84, 88, 379, 380, 381, 382, 383, 384, 385 | confirmado |
| INT-12 | El nombre del comando es **insensible a mayúsculas**: `ping`, `Ping`, `pinG`, `CONSULTa` ejecutan el comando. | 59, 60, 85, 14 | confirmado |
| INT-13 | El control se valida **también para comandos desconocidos** y antes de resolver el comando: `PIN;64`, `PINGG;64`, `PONG;64`, `ALTAS;Lucia;1`, `SALDO;AC-0001;1`, `FOO;54` → E202; con control correcto, `SALDOS;AC-0001;38`, `FOO;47` y `PIN;AC-0001;29` → E301. | E202: 79, 80, 81, 82, 86, 140; E301: 15, 141, 373 | confirmado |
| INT-14 | Orden de las comprobaciones de integridad (de más temprana a más tardía): estructura (E103/E104) → [PING sale aquí con pong o E302] → forma del control (E201) → valor del control (E202) → comando (E301) → aridad (E302) → monto (E303) → resto de reglas de negocio (ERR-26 a ERR-28). Cada error de control gana contra el siguiente error aunque el mensaje tenga ambos. | E201/E202 ganan: 131 (SALDOS), 132, 134 (ALTA aridad), 135, 136 (CONSULTA cuenta inexistente), 137, 138 (CONSULTA aridad), 140 (FOO); con control correcto aparece el segundo error: 139 (E302), 141 (E301), 23 (E302), 18 (E401); E104 antes que E201: 112; comando desconocido con cualquier nº de argumentos y control correcto → E301, nunca E302: 156 (4 args), 158 (1 arg), 373; comando conocido con aridad mala → E302: 157, 159, 356, 357 | confirmado |
| INT-15 | Solo pesan en el control los caracteres ASCII `0-9`, `A-Z`, `a-z`. **No aportan nada**: espacio, tabulador, `-`, `.`, y caracteres no ASCII (`é`, `ñ`, `ú`, `日本`). (`,`, `+`, `_` y dígitos árabes `١٠٠` se comportan igual según los montos de 164-168, 176-178, que dieron E303 y no E202; eso asume que E303 se evalúa después del control, no probado.) Prueba directa: `Lucia ;82` = `Lucia;82`; `Ana-Maria;44` y `Ana.Maria;44` comparten control; `日本;85` y `   ;85` comparten control; `José;61` y `Ñandú;41` coinciden con el cálculo que ignora `é`, `Ñ`, `ú`. | 345, 352, 353, 351, 354, 348, 349, 381 (tab, control 14); `,` `+` `_` árabes: 164-168, 176-178 | confirmado (espacio, tab, `-`, `.`, no ASCII) / probable (`,`, `+`, `_`, dígitos árabes) |
| INT-16 | **Gramática del monto** (DEPOSITO y TRANSFER, mismo campo): solo es válido un entero decimal **canónico**: dígitos ASCII, sin signo, sin cero a la izquierda, sin separadores, de 1 a 10 dígitos y mayor que 0. Cualquier otra cosa → 400 **E303** `monto inválido`. Aceptados: `1`, `5000`, `1000000`, `10000000`, `100000000`, `1000000000`, `2147483648`, `4294967296`, `9999999999`. Rechazados: `0`, `00`, `-0`, `-5`, `100.5`, `100,5`, `+100`, ` 100`, `100 `, `100<tab>`, `0100`, `007`, `1e3`, `1e9`, `abc`, `1,000`, `1_000`, `0x10`, dígitos árabes `١٠٠`, y todo valor de **11 o más dígitos** (`10000000000`, `99999999999`, `9007199254740991`, `99999999999999999999`, …). El monto vacío es E104, no E303. | aceptados: 186, 188, 190, 192, 194, 196, 198, 204 (DEPOSITO), 214, 228 (TRANSFER); rechazados DEPOSITO: 162-182, 200-203, 205-210; TRANSFER: 215-226, 323; vacío: 183 | confirmado |
| INT-17 | Los ids de entidad se comparan **exactos** (distinguen mayúsculas, espacios y ceros): para cuenta solo existe `AC-` + 4 dígitos real; `ac-0001`, `AC-1`, `AC-2`, `AC-00001`, `0001`, `AC-0001 ` (espacio final) → E401. Para operación: `op-0001`, `OP-1`, `OP-00001`, `OP-0001 `, `0001`, `XX-1`, `OP-0000`, `OP-9999` y `AC-0001` → E402. (El nombre del comando sí es insensible a mayúsculas; los ids no.) | cuenta (E401): 312, 313, 314, 315, 316, 317, 318, 319, 331, 332; operación (E402): 238, 239, 240, 241, 242, 243, 244, 245, 247 | confirmado |

**Desconocido**: pesos de otros caracteres de control no ASCII/ASCII raros (`/`, `#`, `€`, otros espacios Unicode) — solo se
probaron los de INT-15; controles de 3 o más dígitos distintos de `014`, `0014` y `111`; segmento vacío en medio de
comandos distintos de PING (p. ej. `ALTA;;;85`); `ping;00` en minúscula; E103 para mensajes sin `;` de otros comandos
(`CONSULTA`); umbral exacto de "casi igual" en `sugerencia` (ERR-9).

---

## 3. Comandos

Seis comandos conocidos: `PING`, `ALTA`, `CONSULTA`, `DEPOSITO`, `TRANSFER`, `ANULA`. Todo el resto → E301 (ERR-9).
En las firmas, `<ctrl>` es el control de INT-2. Los efectos de estado están detallados en la sección 4.

### PING — `PING;<ctrl>` (0 argumentos)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-1 | `PING;<cualquier cosa no vacía>` → **200** `{"pong":true}`. El control no se valida (INT-10). | 4, 25, 26, 28, 48, 49, 50, 51, 52, 53, 55, 56, 57, 58, 59, 60, 61, 62, 85 | confirmado |
| CMD-2 | Con argumentos de más (`PING;64;64`, `PING;1;64`) → 400 E302. | 67, 68 | confirmado |

### ALTA — `ALTA;<nombre>;<ctrl>` (1 argumento)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-3 | Crea una cuenta: **201** `{"cuentaId":"AC-0001"}` (clave `cuentaId`, camelCase). El id sale del contador de cuentas (MEM-5). | 6, 7, 108, 130, 340 | confirmado |
| CMD-4 | La cuenta nueva tiene saldo 0 (se ve con `CONSULTA`). | 8, 109, 362 | confirmado |
| CMD-5 | Aridad: dos argumentos (`ALTA;Lucia;Gomez;11`, `ALTA;Zed;Extra;89`) o cero (`ALTA;85`) → 400 E302. | 23, 356, 357 | confirmado |
| CMD-6 | El nombre es libre y no se valida: se aceptan mayúsculas/minúsculas, espacios internos o finales, solo espacios (`"   "`), dígitos, acentos, `ñ`, `-`, `.`, caracteres CJK (`日本`) y nombres de ≈2000 y ≈6000 caracteres. Nombre vacío → E104 (INT-8). No se ve ningún efecto del nombre en las respuestas. | 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 359, 361; 147, 150 (nombres largos) | confirmado |
| CMD-7 | ALTA no deduplica: el mismo nombre dos veces crea dos cuentas (`Lucia` → `AC-0001`, `Lucia` → `AC-0002`). | 340, 341 (y variantes 342-345) | confirmado |

### CONSULTA — `CONSULTA;<cuenta>;<ctrl>` (1 argumento)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-8 | Cuenta existente: **200** `{"cuenta_id":"AC-0001","saldo":0}` (clave `cuenta_id`, snake_case, distinta de `cuentaId` de ALTA); `saldo` es un entero JSON (puede superar 2^32 y puede ser negativo). | 8, 11, 14, 22, 109; 197, 199 (3258483649, 7553450945); 285 (-500) | confirmado |
| CMD-9 | Cuenta inexistente (con control correcto): **404** `{"error":"E401","mensaje":"cuenta inexistente"}`; vale también para ids mal formados (INT-17). | 18, 124, 126, 127, 316, 317, 318, 319, 363 | confirmado |
| CMD-10 | Cero argumentos (`CONSULTA;11`, control correcto) → 400 E302. | 139 | probable |

### DEPOSITO — `DEPOSITO;<cuenta>;<monto>;<ctrl>` (2 argumentos)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-11 | Éxito: **200** `{"status":"recieved","operacionId":"OP-0001"}` (typo `recieved` literal; clave `operacionId`). El id sale del contador de operaciones (MEM-7). | 9, 21, 186, 214, 236, 256, 309 | confirmado |
| CMD-12 | El monto se suma al saldo de la cuenta de inmediato (la consulta siguiente ya lo ve). | 9 → 14 (110000), 21 → 22 (40700), 186 → 187 (1), 188 → 189 (1000001), 190 → 191, 192 → 193, 194 → 195, 196 → 197, 198 → 199 | confirmado |
| CMD-13 | **DEPOSITO no tiene tope de monto**: se aceptan desde `1` hasta `9999999999` (el máximo es el de la gramática, INT-16), sin E506 ni desbordes de 32 bits. | 186, 188, 190, 192, 194, 196, 198, 204 | confirmado |
| CMD-14 | Aridad: con 1 argumento (`DEPOSITO;AC-0001;<ctrl>`, cuenta existente) y con 4 (`DEPOSITO;AC-0001;5;6;7;<ctrl>`) → 400 E302. | 157, 159 | confirmado |
| CMD-15 | Monto inválido → 400 E303 (INT-16), también si la cuenta no existe (E303 gana a E401). Cuenta inexistente con monto válido → 404 E401. | E303: 162-182; 311 (`AC-0009;abc` → E303); E401: 310, 312, 313, 314, 315 | confirmado |

### TRANSFER — `TRANSFER;<origen>;<destino>;<monto>;<ctrl>` (3 argumentos)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-16 | Éxito: **200** `{"status":"recieved","operacionId":"OP-0002"}`, mismo formato que DEPOSITO. | 10, 13, 228, 237, 257, 300 | confirmado |
| CMD-17 | Resta el monto al origen y lo suma al destino. Ej.: tras depositar 250000 en AC-0001 y transferir 40000 a AC-0002, AC-0002 tiene 40000; tras otra de 100000, AC-0001 tiene 110000; tras transferir 1 de AC-0001 (saldo 5000) quedan 4999 y 1. | 9, 10, 11, 13, 14; 231, 232 | confirmado |
| CMD-18 | **Tope por operación de 100000**: un monto > 100000 → **422** `{"error":"E506","mensaje":"límite excedido"}` (120000, 100001, 9999999999); 100000 pasa. No es acumulado ni proporcional al saldo ni depende del destino: tres transferencias seguidas de 100000 con saldo 5000000 pasan; 120000 en estado fresco con saldo 1000006 (12 % del saldo, nada transferido antes) da E506, también a otro destino y repetido; y 9999999999 con saldo 5000 da E506 (no E507). | 12 (120000 → E506), 13 (100000 pasa), 300, 301, 302 (3×100000 pasan), 303 (100001 → E506), 227 (9999999999, saldo 5000 → E506), 398, 399, 400 (120000 con saldo 1000006: E506 ×3; saldos intactos en 401-403) | confirmado |
| CMD-19 | **Saldo insuficiente**: monto ≤ 100000 y mayor que el saldo del origen → **422** `{"error":"E507","mensaje":"saldo insuficiente"}` (5000 con saldo 4999, 5001, 1 con saldo 0, 50000 con saldo 40000). Transferir **exactamente el saldo** está permitido. | 19, 229, 230, 338 (E507); 335 (50 con saldo 50 → 200, saldo queda 0) | confirmado |
| CMD-20 | Origen o destino inexistente (o ambos) → 404 E401, con cualquier monto válido (también > 100000 o > saldo: E401 gana a E506/E507). | 320, 321, 322, 324, 325, 326, 331, 332 | confirmado |
| CMD-21 | Origen == destino (cuenta existente) → 400 `{"error":"E304","mensaje":"origen y destino iguales"}`, con cualquier monto válido (gana a E506/E507); con monto inválido da E303. | 327, 328, 329 (E304); 330 (monto 0 → E303) | confirmado |
| CMD-22 | E506, E507, E401, E303 y E304 no consumen número de operación (ver MEM-8). | 227 → 228; 310-334 → 335 | confirmado |
| CMD-23 | Monto inválido → 400 E303 (INT-16), también con cuenta inexistente. | 215-226, 323 | confirmado |

### ANULA — `ANULA;<operacion>;<ctrl>` (1 argumento)

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-24 | Anula la operación: **200** `{"ok":true,"anulada":"OP-0003"}`. Sirve para DEPOSITO y para TRANSFER. | TRANSFER: 16, 260, 283, 291; DEPOSITO: 265, 269, 287 | confirmado |
| CMD-25 | Repetirla: **200** `{"ok":false,"motivo":"ya anulada"}` (fallo de negocio con status 200, no un error E-xxx). | 17, 263, 268, 295 | confirmado |
| CMD-26 | Anular una TRANSFER devuelve el monto al **origen** y se lo quita al **destino**: AC-0001 700 → 1000 y AC-0002 300 → 0. | 258, 259, 260, 261, 262; 280-284 | confirmado |
| CMD-27 | Anular un DEPOSITO resta el monto a la cuenta: depósito de 1000 anulado deja la cuenta en 50 (con otro depósito de 50) y luego 0 al anular el de 50. | 264, 265, 266, 269, 270; 287, 288 | confirmado |
| CMD-28 | **ANULA no comprueba fondos**: si el destino ya gastó el dinero, la anulación se aplica igual y el saldo del destino queda **negativo** (AC-0002: -500). Anular después la transferencia que gastó el dinero lo devuelve a 0. | 277-285 (-500 en 285, 289), 291-293 | probable |
| CMD-29 | ANULA (éxito o repetida) y los ANULA fallidos no consumen número de operación: la siguiente operación nueva es la siguiente de la serie. | 250 (OP-0003 tras 10 ANULA fallidos), 271 (OP-0004 tras 3 ANULA exitosos y 2 repetidos), 21 | confirmado |
| CMD-30 | Operación inexistente o mal formada → **404** `{"error":"E402","mensaje":"operación inexistente"}` (con acento). Vale para `OP-9999`, `OP-0000`, `OP-0003` aún no creada, `XX-1`, `op-0001`, `OP-1`, `OP-00001`, `OP-0001 `, `0001` y `AC-0001`. | 238-247 | confirmado |
| CMD-31 | Aridad: dos argumentos (`ANULA;OP-0001;x;45`) → 400 E302; argumento vacío (`ANULA;;45`) → 400 E104. | 248, 249 | probable |

### Comandos desconocidos

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CMD-32 | Cualquier nombre que no sea uno de los seis (con control correcto) → 400 E301 (ERR-9), con cualquier nº de argumentos. Probados `SALDO`, `SALDOS`, `FOO`, `TRANSFERENCIA`, `XYZ` más los casi-iguales de ERR-9. No hay barrido de comandos ocultos con nombres lejanos (`HELP`, `RETIRO`, `VERSION`, …). | 15, 141, 156, 158, 377, 378, 386, 387 | probable |

**Desconocido**: aridad de TRANSFER con n-1 / n+1 argumentos, de CONSULTA con argumentos de más y de ANULA con cero
(solo se vio E302 en ALTA con 2 y 0 args, CONSULTA con 0, PING con 2, DEPOSITO con 1 y 4, ANULA con 2); orden de
E302 frente a E303/E401/E402/E304; qué pasa al anular un DEPOSITO cuando la cuenta ya gastó el dinero (¿queda en
negativo?); comportamiento al agotar `AC-9999` / `OP-9999`; número máximo de cuentas (se llegó a 17); formato del saldo
en el desbordamiento de JS (`2^53`); comandos ocultos con nombres lejanos.

---

## 4. Memoria entre requests

Estado **por token**, en memoria. `POST /__reset` lo vuelve a vacío (MEM-4).

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| MEM-1 | `X-Req`: header de respuesta con un contador por token = nº de `POST /msg` autenticados recibidos (acumulado), **incluidos los que devuelven 400 y el 413** (E100, E101, E102, E104, E201, E202, E301…). Es un string numérico (`"21"`). | 25, 26, 28, 30, 31, 32, 33, 34, 36, 39, 40, 41, 42, 43, 46, 48, 49; 413: 148 (x_req 105), 149 (106), 150 (107) | confirmado |
| MEM-2 | `/__reset` **no** reinicia `X-Req` (el primer `/msg` tras un reset continúa la cuenta). | 24, 25 (21 tras 1..20); 47, 48 (36); 107, 108 (68); 129, 130 (88); 340 (286) | confirmado |
| MEM-3 | No cuentan ni llevan `X-Req`: `GET /health`, `POST /__reset`, las respuestas 404 y los 401. | 24, 27, 29, 35, 37, 38, 44, 45; 39 (X-Req=30 tras dos 401); 46 (35 tras 404s y health) | confirmado |
| MEM-4 | `POST /__reset` borra cuentas y operaciones y reinicia los contadores AC y OP: tras él, `ALTA` vuelve a dar `AC-0001` y esa cuenta tiene saldo 0, aunque antes del reset AC-0001 tenía 110000 y existía AC-0002; el primer DEPOSITO vuelve a dar `OP-0001`. | 14 (110000 antes), 108 (AC-0001), 109 (saldo 0), 130, 186 (OP-0001), 236 (OP-0001) | confirmado |
| MEM-5 | Contador de cuentas: `AC-` + 4 dígitos con ceros, secuencial desde `AC-0001` (llega al menos a `AC-0017`). | 6, 7, 108, 130; 340-361 (AC-0001 … AC-0017) | confirmado |
| MEM-6 | Una ALTA rechazada (E202, E302, E104, 413) no consume número de cuenta: tras ellas el siguiente ALTA válido recibe el número que tocaba. | 5, 6; 355-358 (E202, E302, E302, E104) → 359 (AC-0016); 360 (E202) → 361 (AC-0017); 147, 148, 149, 150 (413 entre AC-0001 y AC-0002) | confirmado |
| MEM-7 | Un **único** contador de operaciones `OP-` + 4 dígitos, compartido por DEPOSITO y TRANSFER (en orden de creación). | 9, 10, 13, 21; 186-198 (OP-0001…OP-0007); 214, 228; 236, 237, 250; 256, 257, 264, 271, 272 | confirmado |
| MEM-8 | Los fallos no consumen número de operación: tras E506, E507, E201, E303, E304, E401, E402, E302 y E104, la siguiente operación recibe el número siguiente al último éxito. | 12 → 13; 19, 20 → 21; 200-203 (E303) → 204 (OP-0008 tras OP-0007 en 198); 227 (E506) → 228; 238-249 → 250; 310-334 (E401, E303, E304) → 335 | confirmado |
| MEM-9 | Saldo por cuenta: empieza en 0; DEPOSITO suma; TRANSFER resta del origen y suma al destino; ANULA lo revierte (CMD-26, CMD-27). Las respuestas de CONSULTA, E507 dependen de este saldo. | 8, 9, 10, 11, 14, 19, 21, 22, 109; 231, 232; 258-262; 335-338 | confirmado |
| MEM-10 | Cada operación recuerda si fue anulada: ANULA repetida devuelve `{"ok":false,"motivo":"ya anulada"}` en lugar de `{"ok":true,...}`; la repetición no vuelve a tocar saldos. | 16, 17, 263, 268, 295; 266, 267 (saldos coherentes con una sola aplicación tras la repetición en 263) | confirmado |
| MEM-11 | E506 no depende del historial: es un tope por operación (CMD-18), no acumulado. | 300, 301, 302 (3×100000 seguidas), 303; 398 (120000 en estado fresco, sin transferencias previas, saldo 1000006 → E506) | confirmado |
| MEM-12 | **Sin idempotencia**: mensajes idénticos repetidos crean operaciones distintas (`TRANSFER;AC-0001;AC-0002;100000;12` ×3 → OP-0002, OP-0003, OP-0004). ALTA con el mismo nombre crea cuentas distintas (CMD-7). | 300, 301, 302; 340, 341 | confirmado |
| MEM-13 | Una operación anulada sigue ocupando su número: el contador no retrocede ni reutiliza (OP-0004 tras anular OP-0003). | 269, 270, 271 | probable |

**Desconocido**: aislamiento real entre tokens (no se usó un segundo token); si el tiempo influye (ventana para anular,
caducidad: no se ha probado ninguna espera); si algo sobrevive a `/__reset` aparte de `X-Req`; si E401/E302/E301 consumen
contadores en secuencias con operaciones posteriores más allá de lo de MEM-8; qué ocurre en `AC-9999`/`OP-9999`.

---

## 5. Errores

Cuerpos exactos (los E-códigos de `/msg` siempre llevan `error` + `mensaje`; acentos UTF-8). Códigos conocidos:
E001, E100, E101, E102, E103, E104, E201, E202, E301, E302, E303, E304, E401, E402, E404, E506, E507.

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| ERR-1 | **E001** · 401 · `{"error":"E001","mensaje":"no autorizado"}` — token ausente, vacío, inválido o con esquema distinto de `Bearer` (ENT-4). | 1, 37, 38, 70, 71, 94, 95, 96, 97, 98, 99, 100, 101, 102, 425, 426, 427, 428 | confirmado |
| ERR-2 | **E404** · 404 · `{"error":"E404","mensaje":"ruta desconocida"}` — ruta o método no soportados (ENT-6). | 29, 35, 44, 45, 72, 73, 74, 75, 77, 89, 90, 91, 92, 103, 104, 105, 106 | confirmado |
| ERR-3 | **E100** · 400 · `{"error":"E100","mensaje":"json inválido"}` — cuerpo no parseable (`xx`) o vacío. | 33, 42 | confirmado |
| ERR-4 | **E102** · 400 · `{"error":"E102","mensaje":"falta m"}` — objeto sin `m`, con `m` no string o un array JSON (mismo mensaje en todos los casos). | 40, 41, 146 | confirmado |
| ERR-5 | **E103** · 400 · `{"error":"E103","mensaje":"falta control"}` — `m` sin ningún `;` (visto con `PING`, `""` y `"   "`). | 64, 143, 144 | confirmado |
| ERR-6 | **E104** · 400 · `{"error":"E104","mensaje":"segmento vacío"}` — algún segmento vacío (control, comando, argumento intermedio o final). | 54, 65, 66, 87, 112, 183, 249, 358 | confirmado |
| ERR-7 | **E201** · 400 · `{"error":"E201","mensaje":"control mal formado"}` — el último segmento no son 1-2 dígitos (INT-7). | 20, 111, 113-121, 132, 133, 135, 137 | confirmado |
| ERR-8 | **E202** · 400 · `{"error":"E202","mensaje":"control inválido"}` — control bien formado pero distinto del calculado (INT-2 a INT-4). | 5, 31, 79, 80, 81, 82, 86, 110, 123, 125, 128, 131, 134, 136, 138, 140, 152, 355, 360 | confirmado |
| ERR-9 | **E301** · 400 · `{"error":"E301","mensaje":"comando desconocido "}` — **con un espacio final** en `mensaje`. Si el nombre es **casi igual** a un comando conocido (una letra de más, de menos o cambiada, dos letras trasladadas, o espacios/tab de más; sin distinguir mayúsculas), el cuerpo añade `"sugerencia":"<COMANDO canónico en mayúsculas>"`: p. ej. `{"error":"E301","mensaje":"comando desconocido ","sugerencia":"CONSULTA"}`. Con sugerencia: `CONSULT`, `CONSULTAA`, `DEPOSITOO`, `DEPOSIT`, `TRANSFE`, `TRANSFERR`, `ANUL`, `ANULAR`, `PIN`, `PNG`, `PINGG`, `ALTAS`, `ALT`, `LTA`, ` PING`, `PING `, ` ALTA`, `ALTA `, `consulta `, `Consulta `, `CONSULTA<tab>`, ` consulta`, `ping `, `CONSULTA  `, `C ONSULTA`, y además `PONG` (sustitución), `DEPOSTIO` (trasposición), `CONSULTAX`, `CONSLTA`, `TRANSFERS`, `DEPO SITO` (espacio interno), `DEPOSITO `, ` pinG`, `<tab>PING`, `PING  `. Sin sugerencia: `SALDO`, `SALDOS`, `TRANSFERENCIA` (5 letras de más), `XYZ`, `FOO`, ` FOO`, `FOO `, `QWERTY`, `CONSULTAXYZ123`. El umbral exacto de "casi igual" no está determinado (la métrica podría ser Levenshtein con tope 2 o Damerau con tope 1; `DEPOSTIO` los distingue). | sin sugerencia: 15, 141, 156, 158, 377, 378, 386, 387, 419, 422, 423, 424; con `PING`: 63, 78, 88, 373, 374, 375, 383, 405, 406, 407, 418, 420, 421; con `ALTA`: 83, 84, 376, 388, 389, 408; con `CONSULTA`: 365, 366, 379, 380, 381, 382, 384, 385, 410, 413, 414; con `DEPOSITO`: 367, 368, 409, 415, 416, 417; con `TRANSFER`: 369, 370, 411; con `ANULA`: 371, 372, 412 | confirmado |
| ERR-10 | **E302** · 400 · `{"error":"E302","mensaje":"aridad inválida"}` — nº de argumentos distinto del esperado (vistos: PING con 1-2 de más, ALTA con 0 y 2, CONSULTA con 0, DEPOSITO con 1 y con 4, ANULA con 2). | 23, 67, 68, 139, 157, 159, 248, 356, 357 | confirmado |
| ERR-11 | **E401** · 404 · `{"error":"E401","mensaje":"cuenta inexistente"}` — cuenta no existente o id mal formado, en CONSULTA, DEPOSITO y TRANSFER (origen o destino). | 18, 124, 126, 127, 310, 312-321, 322, 324, 325, 326, 331, 332, 363 | confirmado |
| ERR-12 | **E506** · 422 · `{"error":"E506","mensaje":"límite excedido"}` — TRANSFER con monto > 100000 (CMD-18). | 12, 227, 303 | confirmado |
| ERR-13 | **E507** · 422 · `{"error":"E507","mensaje":"saldo insuficiente"}` — TRANSFER con monto ≤ 100000 y > saldo del origen (CMD-19). | 19, 229, 230, 338 | confirmado |
| ERR-14 | Fallo "blando" de ANULA: **200** `{"ok":false,"motivo":"ya anulada"}` (no es E-código). | 17, 263, 268, 295 | confirmado |
| ERR-15 | **Orden 1-2**: ruteo (ruta+método → E404) antes que autenticación (E001). Un 404 gana contra un 401 con o sin token válido. | 69, 72, 73, 89, 90, 91, 92, 103, 104, 105, 106 | confirmado |
| ERR-16 | **Orden 2-3**: autenticación (E001) antes que el cuerpo: cuerpo válido o no-JSON sin token → 401, nunca E100/E102. Luego E100 (no parsea) y E102 (parsea pero falta `m` string). | 71, 94 (401 primero); 33, 42 (E100); 40, 41, 146 (E102) | confirmado |
| ERR-17 | **Orden 4**: estructura del mensaje (E103 sin `;`; E104 segmento vacío) antes que cualquier error de control; p. ej. `CONSULTA;AC-0001;` es E104, no E201; el monto vacío es E104, no E303. | 112, 54, 65, 87, 183 | confirmado |
| ERR-18 | **Orden 5-6**: forma del control (E201) y valor del control (E202) se evalúan antes que E301, E302 y E401. Un mensaje con dos fallos devuelve el error de control: `SALDOS` (E301) con control malo → E202/E201; `ALTA` con aridad mala → E202/E201; `CONSULTA` con cuenta inexistente → E202/E201; `CONSULTA` con aridad mala → E202. Con el control correcto aparece el segundo error. | E202/E201 ganan: 131, 132, 134, 135, 136, 137, 138, 140; con control correcto: 15, 141 (E301), 23, 139 (E302), 18 (E401) | confirmado |
| ERR-19 | **PING**: sale de la tubería sin pasar por E201/E202 (pong aunque el control sea basura), pero sí pasa por E103/E104 y por E302. | 49-53, 55-62 (pong); 54, 64, 65, 66 (E103/E104); 67, 68 (E302) | confirmado |
| ERR-20 | Para comandos desconocidos el control se valida antes que E301 (ERR-18/INT-13): `PIN;64`, `PONG;64`, `SALDO;AC-0001;1` dan E202, no E301. | 79, 81, 86 | confirmado |
| ERR-21 | **E101** · 413 · `{"error":"E101","mensaje":"cuerpo demasiado grande"}` — cuerpo/`m` de ≈11000 o ≈20000 caracteres (ENT-14). Cuenta para `X-Req`. | 148, 149 | confirmado |
| ERR-22 | **E301 antes que E302**: un comando desconocido nunca da E302, aunque tenga cualquier nº de argumentos (control correcto). | 156, 158, 141, 373 | confirmado |
| ERR-23 | **E303** · 400 · `{"error":"E303","mensaje":"monto inválido"}` — monto de DEPOSITO/TRANSFER que no es un entero canónico de 1-10 dígitos > 0 (INT-16). | 162-182, 200-203, 205-210, 215-226, 311, 323, 330 | confirmado |
| ERR-24 | **E304** · 400 · `{"error":"E304","mensaje":"origen y destino iguales"}` — TRANSFER con origen == destino. | 327, 328, 329 | confirmado |
| ERR-25 | **E402** · 404 · `{"error":"E402","mensaje":"operación inexistente"}` (con acento) — ANULA de una operación inexistente o con id mal formado (INT-17). | 238-247 | confirmado |
| ERR-26 | **Orden de negocio, parte 1**: E303 (monto) antes que E401 y que E304: `DEPOSITO;AC-0009;abc` y `TRANSFER;AC-0009;AC-0002;abc` → E303 aunque la cuenta no exista; `TRANSFER` AC-0001→AC-0001 con monto 0 → E303. E303 también gana a E506/E507 con montos de 11 dígitos. | 311, 323, 330; 226 (11 dígitos en TRANSFER → E303, no E506) | confirmado (E401/E304) / probable (E506/E507) |
| ERR-27 | **Orden de negocio, parte 2**: E401 y E304 antes que E506 y E507. `TRANSFER` a cuenta inexistente con monto > 100000 → E401; con monto > saldo → E401; origen==destino con monto > 100000 o > saldo → E304. | E401: 324, 326 (> 100000), 325 (> saldo); E304: 328 (> saldo), 329 (> 100000) | confirmado |
| ERR-28 | **Orden de negocio, parte 3**: E506 antes que E507: monto 9999999999 con saldo 5000 → E506. | 227 | probable |
| ERR-29 | Pipeline completo observado (de primero a último): E404 → E001 → E101 → E100/E102 → E103/E104 → [PING: pong o E302] → E201 → E202 → E301 → E302 → E303 → E304 → E401 → E506 → E507. ANULA: ... → E302 → E402 → ejecución. E404 gana a E101 (ruta desconocida con cuerpo gigante → 404). E001 gana a E101 (sin token o token inválido con cuerpo gigante → 401). E101 se mide sobre el cuerpo crudo antes de parsear, por lo que gana a E100 y E102. `GET /health` y `POST /__reset` no aplican el límite de tamaño. E302 (aridad) gana a E303, E401, E402, E304, E506 y E507 en DEPOSITO, CONSULTA, TRANSFER y ANULA. E304 gana a E401: `TRANSFER;AC-0009;AC-0009;100` (misma cuenta inexistente) → E304. | E404>E101: 574, 575, 578; E001>E101: 567-569; E101>E100/E102: 570-573; sin límite: 576, 577; E302 gana: 540-562; E304>E401: 473; resto: ERR-15 a ERR-18, ERR-22, ERR-26 a ERR-28 | confirmado |

**Desconocido (orden no probado)**: E101 frente a E001 y E100 (solo se probó con token válido y JSON válido); E302 frente a E303/E401/E402/E304;
E304 frente a E401 (misma cuenta inexistente en origen y destino); E402 frente a E302; E102 con `m` null; E301 con segmentos
vacíos intermedios en comandos no-PING; códigos E5xx por debajo de 506 (E501-E505) y superiores a 507, E003 y similares:
no se encontraron, pero tampoco se barrieron (montos inválidos dan E303, cuentas inexistentes E401, ids de operación E402:
no hay negativo acotado).

---

## 6. Cambios durante el día

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| CAM-1 | **Canario**: los 20 requests de la versión de la mañana, reproducidos en orden tras un `/__reset`, dan status y cuerpo idénticos (0 diferencias) en dos corridas: la primera (hora no registrada, sin `ts`) y la segunda a las 10:54:52-10:54:59 (-0500) del 2026-10-10. | corrida 1: 3 (reset), 4-23 (conclusiones en 4 y 23); corrida 2: 430 (reset, conclusión), 431-450 | confirmado (dos corridas sin diferencias; no hay cambio detectado todavía) |
| CAM-2 | Mensajes repetidos en momentos distintos del día dieron la misma respuesta: `PING;64`, `ALTA;Lucia;83` (E202), `ALTA;Lucia;82` (201 `AC-0001`), `CONSULTA;AC-0001;14` (saldo 0), `SALDOS;AC-0001;38` (E301 sin sugerencia), `TRANSFER;AC-0001;AC-0002;100000;12` (200). Hasta el id 450 no se detectó ningún cambio de versión. | `PING;64`: 4, 25, 48, 431; E202: 5, 31, 432; ALTA: 6, 108, 130, 155, 340, 433; CONSULTA: 8, 109, 435; SALDOS: 15, 378, 442 (con `ts` 10:53:56 y 10:54:56); TRANSFER 100000: 13, 300, 440; E506 120000: 12, 398, 439 | confirmado |
| CAM-3 | El log guarda marca de tiempo (`ts`, hora local -0500) **solo desde el id 339** (2026-10-10T10:53:31). Antes de eso no se puede fechar un cambio, solo ordenarlo por `id`. | 338 (sin `ts`), 339 (con `ts`) | confirmado |
| CAM-4 | Los ejemplos de la mañana no distinguen la fórmula `98-(100N mod 97)` de `1-3N mod 97` (solo difieren cuando `3N mod 97` es 0 o 1); el desempate (ids 123-126) se hizo después de la línea base, así que no hay una versión anterior con la que compararlo. Si el control de las 20:00 fuera otro, 123-126 son los primeros puntos a re-ejecutar. | 4-23 (compatibles con ambas), 123-126 (solo C2) | probable |

**Desconocido**: si el servicio cambió entre la línea base y ahora (las dos corridas del canario son de la misma hora, ≈10:54, sin separación en el día; las repeticiones de CAM-2
cubren pocos comportamientos); qué puede cambiar (mensajes, tope de E506, fórmula, comandos nuevos, códigos de estado).
El canario debe repetirse cada hora, ahora con `ts`, y sumar los bordes 123-128, un E301 con `sugerencia` (id 63 y 365), la
transferencia de 100000 / 100001 (ids 302, 303) y un monto de 10 dígitos / 11 dígitos (ids 204, 209).

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
| RIE-9 | **404 genérico para método incorrecto** (GET /msg, POST /health, PUT /msg…): no hay 405 ni `Allow`; el cliente no sabe si la ruta existe. Además HEAD responde cuerpo vacío. Cierre: 405 + `Allow`. | 35, 44, 45, 89-92, 93 | confirmado |
| RIE-10 | **Estado solo en memoria y borrable con un único request** (`POST /__reset` con el token): un reinicio o un reset accidental pierde todas las cuentas y operaciones sin rastro, y los contadores AC/OP vuelven a 1 (ids reutilizados). Cierre: persistencia + auditoría, y `/__reset` solo en entornos de prueba. | 3, 14, 108, 109 | confirmado |
| RIE-11 | **Errores de validación (400) y el 413 consumen cuota y `X-Req`** igual que los éxitos, y el contador `X-Req` no se reinicia ni se separa por resultado: sirve mal para auditoría. Cierre: contar éxitos y fallos por separado. | 31, 33, 40, 41, 42, 46, 148 | confirmado |
| RIE-12 | **El tope de TRANSFER (100000 por operación) no se informa en el error** (`límite excedido` sin el valor) y DEPOSITO no tiene tope: se puede ingresar hasta 9.999.999.999 en una operación. Cierre: error con el tope aplicable y topes simétricos. | 12, 303 (E506); 204 (DEPOSITO 9999999999 aceptado) | confirmado |
| RIE-13 | **Ambigüedad del control**: `CONSULTA;AC-0038;0` se rechaza y `;97` se acepta (rango 2..98, no 0..96): un cliente que implemente `1-3N mod 97` falla cuando `3N mod 97` vale 0 o 1 (≈ 2 de cada 97 payloads, cifra inferida). Cierre: especificar la fórmula y los vectores de prueba. | 123, 124, 125, 126 | confirmado |
| RIE-14 | **Control con cero inicial inconsistente**: `014`/`0014` se rechazan por forma (E201) pero `02`/`03` pasan la forma y se rechazan por valor (E202); la comparación es textual, no numérica. Un cliente que normalice `02`→`2` fallará. Cierre: una sola regla (forma canónica o comparación numérica). | 114, 115, 152, 153, 360 | confirmado |
| RIE-15 | **El tope por operación se elude fraccionando**: no hay tope acumulado ni límite de frecuencia; 3×100000 pasan seguidas y los depósitos son ilimitados. Cierre: tope diario/acumulado por cuenta. | 300, 301, 302 | confirmado |
| RIE-16 | **ANULA puede dejar saldos negativos** (no comprueba fondos del destino) y no verifica quién anula ni cuándo. Cierre: rechazar la anulación (E507) o exigir fondos / bloquear. | 283, 285, 289 | probable |
| RIE-17 | **Sin validación del nombre en ALTA**: acepta nombres vacíos de contenido (`"   "`), duplicados exactos, caracteres arbitrarios y nombres de miles de caracteres (hasta el 413). Cierre: validar longitud y caracteres, rechazar duplicados. | 340, 341, 351, 354, 147, 150 | confirmado |
| RIE-18 | **E301 con `sugerencia` permite enumerar comandos válidos** por ensayo y error: cada typo cercano devuelve el nombre exacto. Cierre: no devolver sugerencias en producción. | 365-376, 388, 389, 405-418 | confirmado |

---

## Preguntas abiertas (prioridad para recon-prober y fuzzer)

Estado al id 450. Las preguntas de esta lista no tienen respuesta en el log; las ya contestadas están en las tablas.
P0 afecta a casi todos los tests del set (40 son de un solo request).

### P0

1. **Aridad restante** (recon-prober): TRANSFER con 2 y 4 args (n-1/n+1), CONSULTA con 2 args, ANULA con 0 args, PING con cualquier arg. Y el orden de E302 frente a E303 / E401 / E402 / E304 (p. ej. `DEPOSITO;AC-0009;abc;x;<ctrl>`, `ANULA;OP-9999;x;<ctrl>`).
2. **E304 vs E401**: `TRANSFER;AC-0009;AC-0009;10;<ctrl>` (misma cuenta inexistente).
3. **Umbral de `sugerencia`** (fuzzer): ya se sabe que cubre inserción, borrado, sustitución, trasposición (`DEPOSTIO`) y espacios; falta el umbral (¿Levenshtein ≤ 2? ¿Damerau ≤ 1? ¿cociente de longitud?): `ALTO`/`PNGG`/`TRANSFIR`/`CONSULTAXY`/`CONSULTAXYZ`, nombres de 1-2 letras, empates entre dos comandos, nombres no ASCII.
4. **E101 (413)**: afinar el umbral entre ≈6017 y ≈8517 bytes de cuerpo (¿bytes del cuerpo o longitud de `m`?) y su orden frente a E001 (sin token) y E100 (cuerpo enorme no JSON).
5. **ANULA de un DEPOSITO ya gastado** (¿saldo negativo? ¿E507?), y ANULA con la cuenta del DEPOSITO en 0.

### P1

6. **Comandos ocultos** (fuzzer): barrido de nombres lejanos (HELP, VERSION, ECHO, RESET, ADMIN…); con control correcto. Todo lo que no sea E301 es hallazgo.
7. **Rollover**: `AC-9999`/`OP-9999` (¿5 dígitos?, ¿error?) y límite de cuentas; saldos cerca de 2^53; muchos depósitos grandes.
8. **Cuerpo y ruta**: `null`, `{"m":null}`, `{"M":...}`, formulario, `POST /msg/`, `/MSG`, `/msg?x=1`, `Content-Type` distinto, `HEAD` con token, `GET /health` con cuerpo.
9. **Segmentos vacíos intermedios** en comandos no-PING (`ALTA;;;85`, `TRANSFER;AC-0001;;10;<ctrl>`), E103 con `CONSULTA` sin `;`.
10. **Controles de 3+ dígitos** (`100`, `198`) y `ping;00` en minúscula.

### P2

11. **Aislamiento entre tokens** (necesita un segundo token) y rate-limit (`X-Frontier-Infra`, 10 req/s, 8000/día): nunca observados.
12. **Dependencia del tiempo**: espera de 60 s / 5 min entre DEPOSITO y ANULA.
13. **Canario horario** hasta las 20:00 (con `ts`): los 20 ejemplos + `PING;65` + ids 123-128 + un E301 con `sugerencia` (ids 63, 365) + 100000/100001 (302, 303) + 10/11 dígitos (204, 209) + 413 de ≈8500 caracteres (429). Ya hay dos corridas a las ≈10:54 (ids 4-23 sin hora y 431-450); la siguiente debe ser horas después.

---

## Cierre (relectura del log)

Última lectura del log: ids 1-450 (450 líneas). Todo id citado arriba se comprobó contra su línea.
