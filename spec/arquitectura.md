# Arquitectura y modelo de la caja negra (system-designer)

Estado: **tanda 2**, sobre `experimentos.jsonl` hasta el `id` 141 (otra sesión sigue sondeando; este documento no hace
ningún request). Libro de preguntas: `spec/preguntas.md`.

Convención de evidencia:

- `log#N` = `id` N de `experimentos.jsonl`. **Es la única evidencia citable en la spec.**
- `ej#N` = línea `n=N` de `material/pruebas/ejemplos.jsonl` (versión de la mañana, solo como segunda fuente).
- Confianza: **confirmado** = observado en el log y coincide con otra grabación independiente (`ej#` o un segundo `id`);
  **probable** = una sola observación o inferencia directa; **supuesto** = sin observar (lo que haría el reemplazo por defecto).
- Cada bloque separa **Observado** (ids), **Inferido** (modelo) y **Desconocido**.
- Cálculos reproducibles: `python3 tools/analysis/control.py` (self-check 18/18), `python3 tools/analysis/plan.py list`.
  Desde esta tanda `control()` = C2 (la C1 queda como `control_c1`, refutada).

## 0. Qué cambió respecto a la tanda 1 (contradicciones y confirmaciones)

| # | Tanda 1 decía | El log dice | Evidencia |
|---|---|---|---|
| X1 | El control es C1 `(1-3N) mod 97` (rango 0..96) | **C2** `98 - (3N mod 97)` (rango 2..98). Con C1 habría aceptado `;0` y `;1`; el servicio los rechaza y acepta `;97` y `;98`. La congruencia mod 97 también queda refutada (`0` y `99` rechazados) | log#123-128 |
| X2 | PING valida el control (`PING;65` -> E202 en el canario y en Q1a) | **PING no valida el control**: `00`, `63`, `65`, `99`, `XX`, `100`, `064`, `6`, `-1`, ` 64`, `64 ` dan pong | log#49-53, 55-62 |
| X3 | Auth es la primera etapa (401 en todo) | **Ruta + método se resuelven antes que la auth**: lo desconocido da 404 E404 aunque no haya token o sea inválido. Solo las rutas que existen (`POST /msg`, `POST /__reset`, `GET /health`) piden token | log#69, 72-75, 77, 89-93, 103-106 vs 1, 37, 70, 71 |
| X4 | Los E1xx eran "sin datos" | Existen **E100, E102, E103, E104, E404** (cuerpo, `m`, `;`, segmento vacío, ruta) y se evalúan antes que el control | log#33, 40-42, 54, 64-66, 87, 112, 29 |
| X5 | E301 = `{"error","mensaje"}` | A veces lleva un **tercer campo `sugerencia`** (nombre del comando válido). Es un quirk nuevo | log#63, 78, 83, 84, 88 |
| X6 | E201 = "el último campo no es un entero" | E201 = "el último campo no es 1-2 dígitos ASCII": `014`, `0014`, `111`, `+14`, ` 14`, `14 `, `14.0`, `-83`, `XX` son E201 | log#111, 114-121 |
| X7 | Orden control/comando/aridad/entidad = hipótesis | **Confirmado** E201 -> E202 -> (E301 | E302 | E401): el control gana a los tres (pares con dos errores a la vez). E302 vs E401 sigue abierto | log#131-141, 123/125/128/136/137 |
| X8 | "Token inválido = E001" supuesto | Confirmado para token ausente/vacío/inventado. **Pero** los ids 97, 98, 101, 102 mandaron `Basic`/`bearer` con un token **inválido**: no prueban que el esquema sea sensible a mayúsculas. Sigue abierto (Q3b) | log#95-102 (`auth_sent`) |
| X9 | Lectura de Q4b: "120000 rechazado => H1 o H2" | En una secuencia nueva no hay transferencia previa: bajo H2 (acumulado) 120000 **pasa**. Solo H1 la rechaza. La tabla corregida está en 1.5 y el experimento `e506-v2` en 3 | razonamiento sobre log#10, 12, 13 |
| C1 | 20 ejemplos "probables" | Los 20 ejemplos se reproducen idénticos (status y cuerpo): todo lo de 1.4-1.6 que viene de ellos pasa a **confirmado** (si no se indica otra cosa) | log#4-23 |

## 1. Modelo del original

### 1.1 Integridad: el campo de control

**Observado.**

- `control = 98 - (3N mod 97)`, con `N` el número decimal formado por el payload en mayúsculas (`0-9` -> dígito, `A-Z` ->
  posición 1..26 en decimal; `;`, `-` y espacio no aportan). Equivale a ISO 7064 MOD 97-10 con A=1..Z=26. 18 controles válidos
  de los ejemplos se reproducen en log#4-23; los bordes `3N mod 97 in {0,1}` deciden C2 en log#123-128 (payloads
  `CONSULTA;AC-0038` -> 97, `CONSULTA;AC-0070` -> 98, `CONSULTA;AC-0005` -> 2; los controles 0, 1, 99 dan E202).
- El payload es todo lo anterior al **último** `;`; el control es lo posterior (log#113: `CONSULTA;AC-0001` toma `AC-0001` como control -> E201).
- Forma aceptada del control: dígitos ASCII, **1 o 2 caracteres**. Se acepta `3` (log#7). Dan E201: `XX`, `5X`, `014`, `0014`, `111`,
  `+14`, ` 14`, `14 `, `14.0`, `-83` (log#20, 111, 114-121, 132, 135, 137). Con forma válida y valor distinto: E202 (log#5, 110, 123, 125, 128).
- La comparación es **igualdad exacta** (no congruencia: `0` rechazado cuando C2=97, log#123; `99` cuando C2=2, log#128).
- Mayúsculas/minúsculas no cambian el control (`CONSULTa`, log#14; `Lucia`, log#6) y los espacios no pesan:
  ` ALTA;Lucia;82`, `ALTA ;Lucia;82`, ` PING;64` pasan el control y caen en E301 (log#63, 83, 84, 88).
- **Excepción PING**: no se valida el control (log#49-53, 55-62). Sí se exige un segmento no vacío (`PING;` -> E104, log#54, 65) y `;` (`PING` -> E103, log#64);
  y como máximo uno (`PING;64;64`, `PING;1;64` -> E302, log#67, 68).
- Un comando desconocido **con control incorrecto** da E202, no E301 (`PIN;64`, `PINGG;64`, `PONG;64`, `ALTAS;Lucia;1`, `SALDO;AC-0001;1`, `FOO;54`, `SALDOS;AC-0001;45`:
  log#79-82, 86, 131, 140); con el control correcto da E301 (log#15, 141).

**Inferido.**

- Regex tipo `^\d{1,2}$` ASCII, o `^(\d|[1-9]\d)$`. Los ids 114/115 (`014`, `0014`) tienen 3 y 4 caracteres, así que **no distinguen** "largo" de "cero a la izquierda": hace falta `05`.
- La exención de PING es por nombre (`PING` en mayúsculas tras `toUpperCase`; ` PING` no se exime porque cae en E301 con el control ya validado: log#63).
- El motor es JS/Python/otro: no se sabe. `int()` de Python quedaría descartado (aceptaría `+14` y ` 14`, log#116, 117).

**Desconocido.**

- Caracteres no `[A-Z0-9 ;-]` (`. , + _ / # ñ é €`): Q8a. Esto condiciona los montos `10.5`, `1,000`, `+100` y los nombres con acento.
- `05`/`00`, dígitos unicode, `14\n` (Q1a). Si la exención de PING cubre otros comandos sin argumentos (Q9a).

### 1.2 Pipeline de evaluación y precedencia de errores

Orden **observado** (cada fila tiene un par de errores simultáneos o un barrido que lo fija):

| # | Etapa | Error | Status | Cuerpo exacto | Evidencia | Confianza |
|---|---|---|---|---|---|---|
| 1 | Ruteo exacto: método + ruta, sensible a mayúsculas, sin normalizar `/` final | E404 | 404 | `{"error":"E404","mensaje":"ruta desconocida"}` (`HEAD`: cuerpo vacío) | log#29, 35, 44, 45 (con token); 69, 72-75, 77, 89-93 (sin token); 103-106 (token inválido) | confirmado |
| 2 | Auth (solo rutas que existen) | E001 | 401 | `{"error":"E001","mensaje":"no autorizado"}` | log#1, 37, 38, 70, 71, 94-96, 99, 100; la auth va **antes** de parsear el cuerpo: log#94 | confirmado (esquema con token válido: ver 1.3) |
| 3 | Cuerpo no JSON o vacío (`/msg`) | E100 | 400 | `{"error":"E100","mensaje":"json inválido"}` | log#33, 42 | confirmado |
| 4 | JSON sin `m` o con `m` no string | E102 | 400 | `{"error":"E102","mensaje":"falta m"}` | log#40 (`{}`), 41 (`{"m":5}`) | confirmado |
| 5 | Mensaje sin `;` | E103 | 400 | `{"error":"E103","mensaje":"falta control"}` | log#64 (solo con `PING`) | probable |
| 6 | Segmento vacío (en cualquier posición probada: final, doble, inicial) | E104 | 400 | `{"error":"E104","mensaje":"segmento vacío"}` | log#54, 65, 66, 87, 112. Gana a E201 (112 vs 113), a E202 (87) y a E302 (66) | confirmado |
| 7 | Control (salvo PING): forma | E201 | 400 | `{"error":"E201","mensaje":"control mal formado"}` | log#20, 111, 113-121, 132, 133, 135, 137 | confirmado |
| 8 | Control: valor | E202 | 400 | `{"error":"E202","mensaje":"control inválido"}` | log#5, 110, 123, 125, 128, 131, 134, 136, 138, 140 | confirmado |
| 9 | Comando desconocido (sin recortar, insensible a mayúsculas) | E301 | 400 | `{"error":"E301","mensaje":"comando desconocido "}` (espacio final) y a veces `,"sugerencia":"PING"` | log#15, 141; con sugerencia 63, 78, 83, 84, 88 | confirmado (sugerencia: regla desconocida) |
| 10 | Aridad | E302 | 400 | `{"error":"E302","mensaje":"aridad inválida"}` | log#23, 67, 68, 139; después del control: 134 (E202, no E302), 139 | confirmado |
| 11 | Entidad inexistente (cuenta) | E401 | 404 | `{"error":"E401","mensaje":"cuenta inexistente"}` | log#18, 124, 126, 127 (solo CONSULTA) | confirmado (solo CONSULTA) |
| 12 | Reglas de negocio | E506 / E507 | 422 | `{"error":"E506","mensaje":"límite excedido"}` / `{"error":"E507","mensaje":"saldo insuficiente"}` | log#12 / log#19 | confirmado (solo casos de los ejemplos) |
| 13 | Efecto en el estado | - | 200/201 | ver 1.6 | log#6-22 | confirmado |

Pares que fijan el orden (todos en el log):

- 404 antes que 401: log#103-106 (token inválido + ruta/método inexistente = 404).
- 401 antes que E100: log#94.
- E104 antes que E201/E202/E302: log#112 (`CONSULTA;AC-0001;`), log#87 (`;64`), log#66 (`PING;;`).
- E201 antes que E202 y antes que E301, E302, E401: log#132 (`SALDOS;..;5X`), 135 (`ALTA;Lucia;Gomez;5X`), 137 (`CONSULTA;AC-0009;5X`).
- E202 antes que E301, E302, E401: log#131, 134, 136; también 138 (`CONSULTA;18`: E202; `CONSULTA;11`: E302, log#139), 140/141.
- E301 vs E302: no se pueden solapar (un comando desconocido no tiene aridad).

**Inferido.** E506/E507/E401 van después de la aridad (los E5xx necesitan cuentas válidas); E401 va antes de E50x (la cuenta debe existir para comparar saldo).

**Desconocido (Q2).** E302 vs E401 (aridad incorrecta con cuenta inexistente); E401 vs E506 vs E507 en TRANSFER; E103 con comandos distintos de PING; E104 en segmento intermedio frente a un control inválido; dónde cae la validación del monto (¿E3xx, E5xx, antes o después de E401?); si existen E101, E105+, E203, E303, E402, E501-E505, E508+.

### 1.3 Entrada: rutas, métodos, auth y cuerpo

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| R1 | `GET /health` con token válido: 200 `{"ok":true}`, sin `X-Req` | log#2, 27 | confirmado |
| R2 | `POST /__reset` con token válido: 200 `{"ok":true}`, sin `X-Req` | log#3, 24, 47, 76, 107, 122, 129 | confirmado |
| R3 | `POST /msg` con token válido: ver 1.2 | log#4-23 y siguientes | confirmado |
| R4 | `GET /health` sin token: 401 E001. `POST /__reset` sin token: 401 E001. `POST /msg` sin token (cuerpo válido o no JSON): 401 E001 | log#1, 70, 71, 94 | confirmado |
| R5 | Token inválido, `Bearer ` vacío: 401 E001, idéntico a sin token | log#38, 95, 96, 99, 100 | confirmado |
| R6 | Rutas inexistentes (`/nada`, `/`, `/health/`, `/HEALTH`) con o sin token: 404 `{"error":"E404","mensaje":"ruta desconocida"}`. No hay normalización de `/` final ni de mayúsculas | log#29, 72-75, 77, 103-105 | confirmado |
| R7 | Método incorrecto en ruta existente: 404 E404 (no 405). `GET /msg`, `PUT/DELETE/PATCH/OPTIONS /msg`, `POST /health`, `GET /__reset`. `HEAD /msg`: 404 con cuerpo vacío | log#35, 44, 45, 69, 89-93, 106 | confirmado |
| R8 | Los 404 no cuentan en `X-Req` y no llevan el header | log#29, 35, 44, 45 | confirmado |
| R9 | `X-Req`: contador por token de `POST /msg` autenticados (también los que fallan por E100/E102/E2xx); no se reinicia con `/__reset`; `/health`, `/__reset`, 404 y 401 no cuentan | log#24-46 (21..35) | confirmado |
| R10 | Cuerpo: no JSON o vacío -> E100; JSON `{}` o `m` no string (número) -> E102 | log#33, 40-42 | confirmado |
| R11 | Esquema Authorization con **token válido**: `bearer`, `BEARER`, doble espacio, espacio final, sin esquema, `Basic`. Los ids 97, 98, 101, 102 usaron token inválido y por tanto no prueban nada sobre el esquema | log#97, 98, 101, 102 | **supuesto** (el reemplazo: exactamente `Bearer <token>`) |
| R12 | `[]`, `null`, JSON string, `{"m":null}`, `{"m":""}`, `{"m":[...]}`, clave `M`, claves extra, JSON + basura, `/msg/`, `/msg?x=1`, `HEAD`/`OPTIONS /health` con token, tamaño máximo | - | **supuesto** (E100 si no parsea, E102 si no hay `m` string, 404 para rutas no exactas) |

**Inferido.** Un router exacto `método + ruta` con 404 por defecto antes de cualquier middleware de auth; 404 y 401 no pasan por el contador de `X-Req`; el contador vive en el handler de `/msg` tras la auth.

### 1.4 Estado por token

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| S1 | `POST /__reset` devuelve el token a: sin cuentas, `AC` en 1, saldos y operaciones vacíos. **No** reinicia `X-Req`. | `AC-0001` en log#108, 130 tras haber creado AC-0001/0002 en log#6, 7; saldo 0 en log#109 tras 250000 en log#9; X-Req: log#24-25 | confirmado (AC y saldos); el contador OP tras reset: **no observado** (Q16) |
| S2 | `ALTA` válido: 201 `{"cuentaId":"AC-000n"}`, `n` desde 1, 4 dígitos | log#6, 7, 108, 130 | confirmado |
| S3 | **Un solo** contador `OP-nnnn` para DEPOSITO y TRANSFER | log#9, 10 (OP-0001, OP-0002), 13, 21 | confirmado |
| S4 | ALTA con E202 **no consume** AC | log#5 -> 6 | confirmado |
| S5 | No consumen `OP`: E506 (log#12 -> OP-0003 en 13), E301 (15), E401 (18), E507 (19), E201 (20), ANULA ok (16) y repetida (17): OP-0003 -> OP-0004 en 13 -> 21 | log#12-21 | confirmado |
| S6 | Saldo inicial de una cuenta nueva = 0 | log#8 | confirmado |
| S7 | DEPOSITO suma; TRANSFER resta del origen y suma al destino (250000 -> 210000/40000 y 100000 más: 110000/140000) | log#9-11, 13, 14 | confirmado |
| S8 | ANULA de una TRANSFER **revierte el destino**: con 140000 en AC-0002 (log#13) y ANULA (log#16), `TRANSFER 50000` desde AC-0002 da E507 (log#19) y tras depositar 700 el saldo es 40700 (log#22) | log#13, 16, 19, 21, 22 | confirmado (destino) / **desconocido** (origen: no se consultó AC-0001 tras ANULA) |
| S9 | Se guarda por operación: tipo, monto, origen, destino, anulada | log#16, 17 | probable |
| S10 | Qué consumen E302, E104, E103, E100/E102 y E401 de ALTA/DEPOSITO/TRANSFER | - | supuesto: nada (Q7) |
| S11 | ALTA: nombre sin efecto visible, duplicados permitidos, sin tope; nombre vacío; unicode | - | supuesto (Q7, Q14) |
| S12 | Dependencia del tiempo (ventana de ANULA, caducidad, límites diarios) | - | supuesto: ninguna (Q12c) |
| S13 | Aislamiento por token (un segundo token no ve la cuenta del primero) | enunciado del reto | supuesto (no probado con 2 tokens: Q16) |

### 1.5 Reglas de negocio

**Observado.**

- `TRANSFER;AC-0001;AC-0002;120000` con saldo del origen 210000 -> 422 E506 (log#12). 40000 y 100000 pasan (log#10, 13).
  El saldo alcanzaba, así que E506 no es E507.
- `TRANSFER;AC-0002;AC-0001;50000` con saldo del origen 40000 -> 422 E507 (log#19).
- `ANULA;OP-0003` -> 200 `{"ok":true,"anulada":"OP-0003"}`; repetida -> 200 `{"ok":false,"motivo":"ya anulada"}` (log#16, 17).
  Un fallo de negocio puede ser 200 con `ok:false`.
- `CONSULTA` de cuenta inexistente -> 404 E401 (log#18).

**Inferido: hipótesis de E506** (todas compatibles con log#10, 12, 13; H4 es pregunta lateral).

| H | Regla | Predicción en `e506-v2` (fresco: AC-0001 = 1.000.006, AC-0002 = AC-0003 = 0) |
|---|---|---|
| H1 | tope por operación T en [100000, 119999] | A: `1->2 120000` **rechaza**; B, C rechazan |
| H2 | tope del acumulado transferido en [140000, 159999] | A pasa; B (`1->3 120000`, acumulado 240000) rechaza; C rechaza |
| H3 | proporción del saldo del origen (~50%: pasa 47,6%, rechaza 57,1%) | A, B, C pasan |
| H5 | tope del saldo del **destino** tras la transferencia en [140000, 159999] | A pasa; B pasa (destino distinto); C (`1->2` otra vez, destino 240000) rechaza |
| H6 | remanente mínimo en el origen en (90000, 110000] | A, B, C pasan (quedan 880006, 760006, 640006) |
| H4 | DEPOSITO con su propio tope E506 (> 250000, log#9) | no se prueba aquí: Q4a |

Distinciones: A rechaza => H1. A pasa y B rechaza => H2. A y B pasan y C rechaza => H5. Las tres pasan => H3/H6/tope mayor: seguir con `TRANSFER 500000`
(50%) y con una transferencia que deje el origen por debajo de 90000.

**Desconocido.** El valor exacto del tope; `monto > saldo` vs `>=` en E507; montos 0, negativos, decimales (E501-E505); transferencia a la misma cuenta;
si ANULA devuelve el dinero al origen; ANULA de DEPOSITO, de OP inexistente o mal formada; si ANULA falla cuando el destino ya gastó el dinero.

### 1.6 Respuestas por comando (camino feliz)

| Comando | Argumentos (sin control) | Status | Cuerpo | Evidencia | Confianza |
|---|---|---|---|---|---|
| `PING` | 0 (el control no se valida) | 200 | `{"pong":true}` | log#4, 48-53, 55-62, 85 | confirmado |
| `ALTA` | `nombre` (1) | 201 | `{"cuentaId":"AC-0001"}` | log#6, 7; con 2 args E302: log#23 | confirmado |
| `CONSULTA` | `cuenta` (1) | 200 | `{"cuenta_id":"AC-0001","saldo":0}` | log#8, 11, 14, 22; 0 args E302: log#139 | confirmado |
| `DEPOSITO` | `cuenta;monto` (2) | 200 | `{"status":"recieved","operacionId":"OP-0001"}` | log#9, 21 | confirmado (aridad errónea: **no observada**) |
| `TRANSFER` | `origen;destino;monto` (3) | 200 | `{"status":"recieved","operacionId":"OP-0002"}` | log#10, 13 | confirmado (aridad errónea: no observada) |
| `ANULA` | `operacion` (1) | 200 | `{"ok":true,"anulada":"OP-0003"}` / `{"ok":false,"motivo":"ya anulada"}` | log#16, 17 | confirmado (aridad errónea y errores: no observados) |

### 1.7 Quirks que hay que reproducir (son requisitos, no bugs)

| ID | Quirk | Evidencia | Confianza |
|---|---|---|---|
| Q-01 | `"status":"recieved"` (typo) en DEPOSITO y TRANSFER | log#9, 10, 13, 21 | confirmado |
| Q-02 | E301 con **espacio final**: `"comando desconocido "` | log#15, 141 | confirmado |
| Q-03 | Claves inconsistentes: `cuentaId` (ALTA) vs `cuenta_id` (CONSULTA); `operacionId`, `anulada`, `motivo` | log#6, 8, 9, 16, 17 | confirmado |
| Q-04 | Comando insensible a mayúsculas (`CONSULTa`, `ping`, `pinG`); el nombre **no se recorta** (` PING` -> E301) | log#14, 59, 60, 85, 63, 88 | confirmado |
| Q-05 | Control con 1 dígito sin cero a la izquierda (`3`); con cero a la izquierda y 3+ caracteres, E201 | log#7, 114, 115 | confirmado |
| Q-06 | ANULA repetida = 200 `ok:false` | log#17 | confirmado |
| Q-07 | ALTA 201; DEPOSITO/TRANSFER 200 aunque creen operación | log#6, 9 | confirmado |
| Q-08 | E5xx -> 422, E401/E404 -> 404, E001 -> 401, E1xx/E2xx/E3xx -> 400 | log#12, 18, 29, 1, 5, 15, 20, 23, 33 | confirmado |
| Q-09 | Mensajes con tildes UTF-8 (`inválido`, `límite`, `vacío`) | log#5, 12, 54 | confirmado |
| Q-10 | E301 con `sugerencia` solo en nombres que difieren de uno válido en espacios (regla exacta: Q9c) | log#63, 78, 83, 84, 88 vs 15, 141 | probable |
| Q-11 | PING ignora el control, pero exige segmento no vacío y a lo sumo uno | log#49-68 | confirmado |
| Q-12 | `X-Req` en cada respuesta de `/msg` autenticada; ausente en `/health`, `/__reset`, 404, 401 | log#24-46 | confirmado (header; no se compara) |

**Sugerencia: Observado / Inferido / Desconocido.** Observado: aparece con `" PING"`, `"PING "`, `" ALTA"`, `"ALTA "` (valor = comando válido en mayúsculas) y no con `SALDOS`, `FOO`.
Inferido (una de dos): (S-A) `sugerencia = cmd.trim().toUpperCase()` si pertenece al conjunto conocido; (S-B) comando conocido a distancia de edición pequeña
(1 o 2). Desconocido: cuál; formato con minúsculas (` pinG`); qué hace con dos candidatos. Los E202 de log#79-82 (`PIN`, `PINGG`, `PONG`, `ALTAS`) **no** deciden:
el control era incorrecto. Experimento `sug-2`.

### 1.8 Versiones durante el día

**Observado.** log#4-23 reproduce los 20 ejemplos con 0 diferencias (línea base de la tanda 1). El log no guarda la hora del request: no se puede fechar el canario
ni el momento de un posible cambio. La hora se infiere hoy solo por el orden de ids.

**Hipótesis** (supuestos): cambia la fórmula del control, los mensajes, el tope E506, aparecen comandos o campos (`sugerencia` podría ser uno de los cambios del día, pero no hay forma de saberlo: no sabemos si estaba en la mañana;
`ej#12` no lo tiene porque `SALDOS` tampoco lo tendría).

**Detección.** Canario v2 = los 20 ejemplos + 12 puntos nuevos que cubren las reglas descubiertas hoy; ejecutarlo ahora (línea base) y cada hora; diferencias = candidatas, no causa.
Añadir a `tools/probe.py` un campo `ts` (hora UTC) por línea. Los 12 puntos extra (mensajes con control C2):

```
PING;65            -> pong                      (PING exento, log#51)
PING               -> E103
PING;              -> E104
 PING;64           -> E301 con sugerencia PING  (log#63)
FOO;47             -> E301 sin sugerencia       (log#141)
CONSULTA;11        -> E302                      (log#139)
CONSULTA;AC-0038;0 -> E202                      (log#123)
CONSULTA;AC-0038;97-> E401                      (log#124)
CONSULTA;AC-0001;14 (tras ALTA;Lucia;82)         -> saldo 0
CONSULTA;AC-0001;014 -> E201                    (log#114)
ALTA;Lucia;Gomez;18 -> E202                     (log#134)
+ raw: GET /nada -> 404 E404; POST /msg {} -> E102
```

Cada experimento de la sección 3 se repite tras un cambio. Si el canario cambia, parar y bisectar con los ids viejos.

## 2. Arquitectura del reemplazo

Lo más simple que reproduce el modelo. Sin base de datos, sin LLM, sin infraestructura adicional.

| Decisión | Elección | Por qué |
|---|---|---|
| Entrada | `app/[[...path]]/route.ts` exporta GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS y delega en `handle(method, pathname, authHeader, rawBody)` | Next no decide nada por su cuenta: sin redirects de `/` final, sin 404 propio, ni 405. `HEAD /msg` -> 404 con cuerpo vacío (log#93) |
| Lógica | `lib/service.ts`: función **pura y síncrona** `handle() -> {status, body, headers}` | sin `await` entre leer y mutar el estado: sin carreras; <1 ms por paso |
| Estado | `globalThis.__caja ??= new Map<token, Store>()`; `Store = {cuentas, ops, siguienteAC, siguienteOP, xreq}` | un proceso; `globalThis` por las recargas de `next dev`. `xreq` **no** se reinicia con `/__reset` (log#24-25) |
| Reset | `POST /__reset` con token válido: `{ok:true}`; crea cuentas/ops/contadores nuevos, conserva `xreq` | log#3, 108, 109, 130 |
| Runtime | `nodejs`, `force-dynamic`; **no** edge/serverless | edge/serverless reparte en instancias con estado distinto |
| Despliegue | Railway/Render/Fly con 1 instancia, `pnpm build && pnpm start`, sin scale-to-zero, `PORT` fijo | el set le habla a un solo proceso; arranque en frío > 5 s rompe un paso |
| Verificación | `tools/replay.py` con los 20 ejemplos, el canario v2 y cada secuencia de la sección 3 con su resultado real | |

### Estructura interna de `handle()` (orden observado en 1.2)

1. Router exacto: `POST /msg`, `POST /__reset`, `GET /health`; cualquier otra cosa (método + ruta, sensible a mayúsculas, `/` final cuenta) -> **404** `{"error":"E404","mensaje":"ruta desconocida"}` (HEAD: cuerpo vacío).
2. Auth: `Authorization === "Bearer " + TEAM_TOKEN` (supuesto para variantes de esquema: R11) o 401 E001 (cualquier ruta que existe, antes del cuerpo).
3. `/health` -> 200 `{"ok":true}`; `/__reset` -> reset + 200 `{"ok":true}` (ninguno cuenta en `X-Req`).
4. `/msg`: incrementar `xreq` (cuenta desde este punto, también los errores siguientes); `JSON.parse` (E100); `m` string (E102).
5. `m` sin `;` -> E103. Dividir por `;`; cualquier segmento vacío -> E104.
6. Si `campos[0].toUpperCase() !== "PING"`: control = último segmento; forma `^\d{1,2}$` (E201); valor `=== control_c2(payload)` (E202). `payload` = todo antes del último `;`.
7. Comando en `{PING, ALTA, CONSULTA, DEPOSITO, TRANSFER, ANULA}` tras `toUpperCase()` sin recortar, si no E301 (`mensaje` con espacio final; `sugerencia` con la regla S-A hasta resolver Q9c).
8. Aridad por comando (PING: 1 segmento tras el nombre, o E302; ALTA 1 arg; CONSULTA 1; DEPOSITO 2; TRANSFER 3; ANULA 1) -> E302.
9. Ejecución: E401 (cuenta inexistente), reglas de negocio (E506/E507; **provisional**: tope por operación H1 hasta resolver Q4b), mutación solo si todo pasa. Fallos no consumen contadores (S4, S5).
10. JSON con las claves tal cual (`cuentaId`, `cuenta_id`, `recieved`), `mensaje` con tildes.

Pruebas locales: los 20 ejemplos, los 12 puntos del canario v2 y los bordes de control (`CONSULTA;AC-0038;97` aceptado, `;0` rechazado).

Riesgos de arquitectura: reinicio del proceso (estado perdido; el set llama a `/__reset` antes de cada test); arranque en frío; rate limit de la plataforma. Si hubiera evidencia de persistencia
más allá de `/__reset`, reabrir la decisión de no usar DB (hoy no la hay).

## 3. Próximos experimentos priorizados

Reglas: un token por explorador (`CAJA_TOKEN`), todo por `tools/probe.py`, `concluir` solo con lo que prueba esa línea. Presupuesto: ~12% de los 8.000/día para todo esto
(≈ 1.000 requests incluidos 10 canarios v2); el cuello es el ritmo (10 req/s) y no el cupo, así que el resto del cupo es para el fuzzer.
Si aparece E202 donde la lista no lo espera, parar: Q8 (carácter con peso) o error de fórmula.

### P0: reglas que comparten muchos tests

#### E1. `e506-v2` — naturaleza de E506 (13 requests; separa H1/H2/H3/H5/H6; bisección adaptativa después)

```
python3 tools/probe.py seq e506-v2 'Q4b: 120000 desde saldo 1.000.006 en estado fresco (H1 rechaza; H2/H3/H5/H6 pasan); B a destino nuevo (H2 rechaza); C al mismo destino (H5 rechaza)' \
  'ALTA;Lucia;82' 'ALTA;Mateo;3' 'ALTA;Ana;50' \
  'DEPOSITO;AC-0001;250000;86' 'DEPOSITO;AC-0001;250001;83' 'DEPOSITO;AC-0001;250002;80' 'DEPOSITO;AC-0001;250003;77' \
  'TRANSFER;AC-0001;AC-0002;120000;55' 'TRANSFER;AC-0001;AC-0003;120000;71' 'TRANSFER;AC-0001;AC-0002;120000;55' \
  'CONSULTA;AC-0001;14' 'CONSULTA;AC-0002;11' 'CONSULTA;AC-0003;8'
```

- Si A (primer TRANSFER) da E506: H1. Bisección dentro de [100000, 119999] con `TRANSFER;AC-0001;AC-0002;<n>` (los fallos no consumen OP ni saldo, S5): ~14 requests.
  El tope exacto y si es `>` o `>=`. Un `100000` pasa seguro (log#13); empezar por 110000.
- Si pasan A y B y rechaza C: H5 (tope del saldo del destino). Bisecar el saldo máximo del destino.
- Si pasan las tres: H3/H6/tope mayor. Siguientes: `TRANSFER 500000` con saldo 1.000.006; `TRANSFER` que deje el origen en 95000 y en 105000.
- Después, `q4a-deposito-limite` (DEPOSITO 1M/10M/100M: `python3 tools/analysis/plan.py probe Q4a`).

#### E2. `q8a` + `q5` — caracteres del control y gramática del monto (11 + 29 requests; destraba E501-E505)

```
python3 tools/analysis/plan.py probe Q8a      # 11 requests; el espacio ya se sabe ignorado (log#83,84,88), A B queda de confirmación
python3 tools/analysis/plan.py probe Q5       # 29 requests: 0, -5, 10.5, abc, "", 1e3, 0100, +100, " 100", "100 ", 1,000, 007, 2^53+1, 20 dígitos
```

Para cada E202 en Q5, barrer Q8b antes de deducir nada del monto. Qué se aprende: E50x/E3xx distintos, si `0100` se guarda como 100 (el `CONSULTA` tras cada depósito),
si el monto es entero, y si hay tope de dígitos. Es el bloque con más tests potenciales (todo test de DEPOSITO/TRANSFER inválido).

#### E3. `sug-2` — regla del campo `sugerencia` (13 requests)

```
python3 tools/probe.py seq sug-2 'E301: sugerencia ¿por espacios (S-A) o por distancia de edición (S-B)? controles C2 correctos, no habrá E202' \
  'PIN;87' 'PINGG;28' 'PONG;98' 'ALTAS;2' 'DEPOSTIO;22' 'CONSULT;12' 'TRANSFERS;14' 'ANUL;93' \
  ' pinG;64' ' FOO;47' $'\tPING;64' 'PING  ;64'
```

Predicciones: S-A -> solo ` pinG` (valor `PING` o `pinG`: formato), `\tPING` (¿tab cuenta como espacio?) y `PING  ` llevan sugerencia; S-B -> también `PIN`, `PINGG`, `ALTAS`, `CONSULT`, `ANUL`...
Un E202 aquí delata un error de control (volver a verificar con `control.py msg`).

#### E4. `q6a` + `q6b` — ANULA (14 + 12 requests)

```
python3 tools/analysis/plan.py probe Q6a   # ANULA de DEPOSITO, OP-0099, OP-1, op-0001, AC-0001, sin arg, 2 args; saldo tras anular
python3 tools/analysis/plan.py probe Q6b   # el origen recupera el dinero?, el destino ya gastó, orden de anulaciones
```

Resuelve S8 (origen), los errores de ANULA (¿E402? ¿200 `ok:false` con otro `motivo`?) y la aridad de ANULA.

#### E5. `q4c` + `q9b` — entidad, precedencias de TRANSFER y aridad de todos los comandos (13 + 16 requests)

```
python3 tools/analysis/plan.py probe Q4c   # E401 vs E506 vs E507; misma cuenta; monto 0; saldo exacto
python3 tools/analysis/plan.py probe Q9b   # n-1 y n+1 argumentos de cada comando
```

Cierra Q2 (E302 vs E401; E401 vs E50x; E506 vs E507) y la aridad de DEPOSITO/TRANSFER/ANULA.

### P1: entrada y control

#### E6. `q3-resto` — cuerpos, rutas y E1xx faltantes (≈ 30 raw requests)

Probar con token válido (los de 29, 35, 44, 45 ya existen):

```
python3 tools/probe.py raw q3-body-array 'cuerpo [] (¿E101?)' POST /msg '[]'
python3 tools/probe.py raw q3-body-null 'cuerpo null' POST /msg 'null'
python3 tools/probe.py raw q3-body-num 'cuerpo 5' POST /msg '5'
python3 tools/probe.py raw q3-body-str 'cuerpo string JSON' POST /msg '"PING;64"'
python3 tools/probe.py raw q3-m-null '{"m":null}' POST /msg '{"m":null}'
python3 tools/probe.py raw q3-m-empty '{"m":""}' POST /msg '{"m":""}'
python3 tools/probe.py raw q3-m-array '{"m":["PING;64"]}' POST /msg '{"m":["PING;64"]}'
python3 tools/probe.py raw q3-M-upper '{"M":..}' POST /msg '{"M":"PING;64"}'
python3 tools/probe.py raw q3-extra-key 'clave extra' POST /msg '{"m":"PING;64","x":1}'
python3 tools/probe.py raw q3-trailing-garbage 'JSON + basura' POST /msg '{"m":"PING;64"} x'
python3 tools/probe.py raw q3-slash-msg 'POST /msg/ con token' POST /msg/ '{"m":"PING;64"}'
python3 tools/probe.py raw q3-query-msg 'POST /msg?x=1 con token' POST '/msg?x=1' '{"m":"PING;64"}'
python3 tools/probe.py raw q3-head-health 'HEAD /health con token' HEAD /health
python3 tools/probe.py raw q3-options-health 'OPTIONS /health con token' OPTIONS /health
python3 tools/probe.py raw q3-health-query 'GET /health?x=1 con token' GET '/health?x=1'
python3 tools/probe.py raw q3-reset-body 'POST /__reset con cuerpo' POST /__reset '{"x":1}'
python3 tools/probe.py raw q3-root-token 'GET / con token' GET /
python3 tools/probe.py raw q3-m-5k 'm de 5000 caracteres (tamaño máximo)' POST /msg "{\"m\":\"PING;$(python3 -c 'print("9"*5000)')\"}"
python3 tools/probe.py raw q3-m-50k 'm de 50000 caracteres' POST /msg "{\"m\":\"PING;$(python3 -c 'print("9"*50000)')\"}"
```

(el log guarda el cuerpo entero; 50k es el máximo razonable). Pregunta que resuelve: dónde está E101 y si hay otros E1xx; qué cuenta en `X-Req`.

#### E7. `ctrl-2` — forma del control (6 requests)

```
python3 tools/probe.py seq ctrl-2 'Q1a: 2 caracteres con cero a la izquierda (05, 00, 09) -> E202 si la forma pasa, E201 si no; dígitos unicode y salto de línea fingerprint del motor' \
  'CONSULTA;AC-0001;05' 'CONSULTA;AC-0001;00' 'CONSULTA;AC-0001;09' 'CONSULTA;AC-0001;١٤' 'CONSULTA;AC-0001;１４' $'CONSULTA;AC-0001;14\n'
```

Con `ALTA;Lucia` antes no hace falta: el control correcto de `CONSULTA;AC-0001` es 14, así que `05/00/09` son siempre incorrectos y la respuesta distingue la forma (E202 = forma ok).

#### E8. `auth-2` — esquema con token **válido** (6 raw requests)

`$TOK` = el token de la sesión (exportado como `CAJA_TOKEN`; el helper no lo imprime ni lo guarda aparte, queda solo en `auth_sent` del log: **revisar `.gitignore`/no publicar** ese campo
antes de commitear `experimentos.jsonl`, que hoy es público).

```
python3 tools/probe.py raw auth-2-lower 'esquema bearer con token válido' GET /health --auth-raw "bearer $CAJA_TOKEN"
python3 tools/probe.py raw auth-2-upper 'esquema BEARER con token válido' GET /health --auth-raw "BEARER $CAJA_TOKEN"
python3 tools/probe.py raw auth-2-dbl 'Bearer con dos espacios' GET /health --auth-raw "Bearer  $CAJA_TOKEN"
python3 tools/probe.py raw auth-2-trail 'Bearer con espacio final' GET /health --auth-raw "Bearer $CAJA_TOKEN "
python3 tools/probe.py raw auth-2-bare 'token sin esquema' GET /health --auth-raw "$CAJA_TOKEN"
python3 tools/probe.py raw auth-2-basic 'Basic con token válido' GET /health --auth-raw "Basic $CAJA_TOKEN"
```

Atención: `probe.py` escribe `auth_sent` en el log. Con token válido eso **filtraría el token** en un repo público. Antes de ejecutar este bloque, el caller debe cambiar `probe.py` para
guardar `auth_sent` ofuscado (`<TOKEN>` en lugar del valor).

### P2

- `q7` (ALTA duplicada, qué consume E302/E401, nombres vacío/largo; 13): `python3 tools/analysis/plan.py probe Q7`.
- `q10` (idempotencia, 5): `... probe Q10`. `q11` (forma de ids de cuenta, 8): `... probe Q11`.
- `q9a` (48 nombres de comandos; cualquier no-E301 es un comando oculto): `... probe Q9a`. Reordenar: primero los de dinero y cuenta (`SALDO`, `BAJA`, `RETIRO`, `RETIRAR`, `HISTORIAL`, `LIMITE`) con control C2.
- `q16` (aislamiento por token: otro token no ve AC-0001; contador OP tras reset): `ALTA`, `DEPOSITO`, `/__reset`, `DEPOSITO` y `CONSULTA`, con dos tokens.
- Canario v2 cada hora (1.8) + `q12c` (esperar 60 s y 5 min entre DEPOSITO y ANULA con token propio) + `q14`.

Criterio de parada: no declarar el modelo cerrado mientras haya preguntas abiertas en `spec/preguntas.md` de Q2, Q4b, Q5, Q6 y Q9c.

## 4. Lo que NO sabemos aunque suene a hecho

- Que el esquema `Bearer` sea sensible a mayúsculas (log#98, 102 usaron token inválido).
- Qué es E506 (cinco hipótesis vivas, 1.5) y cuál es el valor del tope; si DEPOSITO tiene tope.
- Que ANULA devuelva el dinero al **origen**.
- La regla del campo `sugerencia` de E301.
- La gramática del monto y los E501-E505.
- Dónde está E101 y cualquier respuesta a cuerpos JSON que no son un objeto con `m`.
- Que el servicio de las 20:00 sea el de los ejemplos y el de log#4-23 (el log no guarda la hora).
