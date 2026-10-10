# Arquitectura y modelo de la caja negra (system-designer)

Estado: **tanda 1, sin token**. No se ha hecho ningún request al original. Todo lo de abajo sale de
`material/pruebas/ejemplos.jsonl` (versión de la mañana) y de una línea de nuestro log.

Convención de evidencia:

- `ej#N` = línea `n=N` de `material/pruebas/ejemplos.jsonl`. **No es nuestro log**: todo lo que
  solo tenga `ej#` es **probable** como máximo, y `spec-writer` no puede citarlo como evidencia
  de la spec hasta que `recon-prober` lo reproduzca y quede un `id` de `experimentos.jsonl`.
- `log#N` = `id` N de `experimentos.jsonl` (hoy solo existe `log#1`).
- Confianza: **confirmado** (probado y repetido en nuestro log), **probable** (visto una vez o
  inferido), **supuesto** (no observado; es lo que haría el reemplazo por defecto).
- Reproducir cálculos: `python3 tools/analysis/control.py` (self-check, 18 controles válidos + los
  2 inválidos de los ejemplos) y `python3 tools/analysis/plan.py list` (secuencias de la sección 3).

---

## 1. Modelo del original

### 1.1 Integridad: el campo de control

**Resultado: la fórmula explica los 20 ejemplos** (18 controles correctos, `ej#2` y `ej#17`
inválidos por la razón correcta). Confianza: **probable** (20 puntos, ninguno en nuestro log).

```
payload = mensaje sin el último ';' ni lo que viene después     ("ALTA;Lucia;82" -> "ALTA;Lucia")
N       = número decimal que resulta de concatenar, para cada carácter del payload en MAYÚSCULAS:
            '0'..'9'  -> el propio dígito
            'A'..'Z'  -> su posición en el alfabeto escrita en decimal (A=1 ... I=9, J=10 ... Z=26)
            otro      -> nada (';' y '-' son los únicos vistos; el resto es hipótesis, Q8)
control = (1 - 3*N) mod 97          [C1]       equivale a   (N*100 + control) mod 97 == 1
```

Es el checksum MOD 97-10 de IBAN (ISO 7064) con A=1..Z=26 en lugar de A=10..Z=35. Se calcula en una
pasada sin enteros grandes: `h = (h * 10^largo(v) + v) mod 97` con `v` el valor del carácter.

Ejemplo `ej#1`: `PING` -> P=16 I=9 N=14 G=7 -> N=169147 -> 3N mod 97 = 34 -> 1-34 mod 97 = **64**. `ej#3`:
`ALTA;Lucia` -> `1 12 20 1 12 21 3 9 1` -> 1122011221391 -> **82**.

| Evidencia | Qué prueba |
|---|---|
| `ej#1,3,4,5,6,7,8,10,11,13,14,18,19` (éxitos 200/201) | el control del mensaje coincide con C1 (13 coincidencias; azar ≈ 97^-13) |
| `ej#9,12,15,16,20` (errores de 4xx *distintos* de E2xx) | llevan un control correcto: estos errores ocurren **después** de pasar el control, o el control se evalúa y no importa; el orden exacto **no** está probado (ver 1.2) |
| `ej#2` `ALTA;Lucia;83` -> 400 E202 | 83 es un entero bien formado pero C1 da 82: **comparación exacta**, no "cualquier número" |
| `ej#17` `...;700;5X` -> 400 E201 | "5X" no es un entero; su control correcto sería 35 (`ej#18`) |
| `ej#4` `ALTA;Mateo;3` | el control **no se rellena a 2 dígitos** ("3", no "03") |
| `ej#11` `CONSULTa` = control 14 de `CONSULTA` (`ej#5`) | mayúsculas/minúsculas no cambian el control (se pasa a mayúsculas, o los pesos son iguales) |
| `ej#3` `Lucia` en minúscula pesa como `LUCIA` | idem para los argumentos |

**Candidatas que los ejemplos no distinguen** (hay que desempatarlas; los experimentos están en Q1):

| ID | Candidata | Difiere de C1 en | Experimento que desempata |
|---|---|---|---|
| C1 | `(1-3N) mod 97`, rango 0..96, igualdad estricta | (base) | Q1b |
| C2 | `98 - (100N mod 97)`, rango 2..98 (forma ISO 7064 "pura") | solo si `3N mod 97` in {0,1}: C1 da 1 o 0, C2 da 98 o 97 | Q1b: `CONSULTA;AC-0070;1`/`98` y `CONSULTA;AC-0038;0`/`97` |
| C3 | validación por congruencia: `(100N + c) mod 97 == 1` (acepta `c` y `c+97`) | acepta controles de 3 cifras y `c+97` | Q1a `PING;161`, Q1b `...;97`, `...;98`, `...;99` |
| C4 | límite de longitud del campo (máx. 2 cifras) -> E201 en `PING;161`/`PING;064` | solo forma | Q1a |
| W1 | el servicio pondera/ignora otros caracteres (espacio, `.`, `_`, acentos) | solo con esos caracteres | Q8a/Q8b |

Descartadas por los ejemplos (el self-check lo comprueba): suma de bytes mod 97/100, ASCII decimal
concatenado, acumulado `h*10+v` sin desplazar por ancho de `v`, CRC32/Adler/MD5 mod M, hashes
polinomiales de base B mod 97 con pesos afines, y pesos por posición. La pista que lo resolvió: pasar
`'1'` -> `'2'` al final de `CONSULTA;AC-000x` baja el control en 3 (14 -> 11) y `'1'` -> `'9'` lo sube 73,
que solo cuadra módulo 97 con peso 3 por unidad = `100 mod 97`; entre `100000` y `120000` (`ej#10`,
`ej#9`) el dígito de las decenas de millar pesa 10^4 mod 97: los dígitos forman un número **decimal**.

### 1.2 Pipeline de evaluación y precedencia de errores

El orden de abajo es la **mejor hipótesis**, ordenada por la numeración de los códigos (E0xx auth,
E2xx control, E3xx comando, E4xx entidad, E5xx negocio). Ningún ejemplo prueba el orden *entre* etapas:
en todos los errores de los ejemplos las demás etapas pasan limpias. Lo único observado es cada etapa
sola. Confianza del **orden**: **supuesto**; de cada etapa individual: **probable**.

| # | Etapa | Error | Status | Cuerpo exacto | Evidencia |
|---|---|---|---|---|---|
| 1 | Autenticación (Bearer) | E001 | 401 | `{"error":"E001","mensaje":"no autorizado"}` | `log#1` (solo `GET /health` sin token); resto supuesto |
| 2 | Ruta/método/cuerpo JSON (`m` string) | ¿E1xx? | ? | ? | sin datos (Q3). Tampoco sabemos si existe E1xx |
| 3 | Control **mal formado** (el último campo no es un entero) | E201 | 400 | `{"error":"E201","mensaje":"control mal formado"}` | `ej#17` |
| 4 | Control **inválido** (entero distinto del calculado) | E202 | 400 | `{"error":"E202","mensaje":"control inválido"}` | `ej#2` |
| 5 | Comando desconocido (insensible a mayúsculas) | E301 | 400 | `{"error":"E301","mensaje":"comando desconocido "}` (con **espacio final**) | `ej#12`, caso `ej#11` |
| 6 | Aridad | E302 | 400 | `{"error":"E302","mensaje":"aridad inválida"}` | `ej#20` |
| 7 | Entidad inexistente (cuenta) | E401 | 404 | `{"error":"E401","mensaje":"cuenta inexistente"}` | `ej#15` |
| 8 | Reglas de negocio: límite | E506 | 422 | `{"error":"E506","mensaje":"límite excedido"}` | `ej#9` |
| 8 | Reglas de negocio: saldo | E507 | 422 | `{"error":"E507","mensaje":"saldo insuficiente"}` | `ej#16` |
| 9 | Ejecución (efecto en el estado) | - | 200/201 | ver 1.5 | |

Lagunas visibles en la numeración (hipótesis de existencia, **a buscar**): E003/E002 (token inválido),
E1xx (cuerpo), E203, E303, E402 (OP inexistente), **E501-E505** (cinco códigos de negocio por debajo de
E506: monto inválido/cero/negativo, misma cuenta, cuenta duplicada, depósito...) y E508+. Q4c, Q5, Q6, Q7 los
buscan. **Aridad vs control**: `ej#20` (`ALTA;Lucia;Gomez;11`) tiene control correcto (C1 = 11), así que
no sabemos si E302 ocurre antes o después de E202; Q2 lo resuelve.

Precedencias a decidir con experimentos (cada uno rompe dos cosas a la vez): E201 vs E202 (trivial),
control vs comando, control vs aridad, comando vs aridad, aridad vs E401, E401 vs E506/E507, E506 vs E507
(Q2 y Q4c).

### 1.3 Estado por token

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| S1 | Estado aislado por token; `POST /__reset` lo devuelve a: sin cuentas, contador AC en 1, contador OP en 1 | `ej#3` (`AC-0001` tras reset), `ej#6` (`OP-0001`), `material/README.md` | probable |
| S2 | Contador de cuentas `AC-0001`, `AC-0002`...: 4 dígitos con ceros; ALTA exitoso -> 201 `{"cuentaId":"AC-000n"}` | `ej#3,4` | probable |
| S3 | **Un solo** contador de operaciones `OP-nnnn` compartido por DEPOSITO y TRANSFER (`OP-0001` depósito, `OP-0002` transferencia) | `ej#6,7` | probable |
| S4 | ALTA con control inválido (E202) **no consume** AC: el siguiente ALTA válido recibe `AC-0001` | `ej#2,3` | probable |
| S5 | E506 y E507 **no consumen** OP: `OP-0002` -> (E506) -> `OP-0003`; E507 + E201 + ANULA -> `OP-0004` | `ej#9,10,13,14,16,17,18` | probable |
| S6 | ANULA exitosa y repetida **no consume** OP | `ej#13,14,18` | probable |
| S7 | Saldo inicial de una cuenta nueva = 0 | `ej#5` | probable |
| S8 | DEPOSITO suma al saldo; TRANSFER resta de origen y suma a destino (`250000 -> 210000 / 40000`) | `ej#6,7,8` | probable |
| S9 | ANULA de una TRANSFER **revierte el destino**: tras `ANULA;OP-0003` (`ej#13`) la cuenta AC-0002 vuelve a 40000 (`E507` en `ej#16` con 50000 > 40000 y `40700` en `ej#19`; sin reversión tendría 140000/140700). **No observado**: que el origen recupere los 100000 (nadie consulta AC-0001 después) | `ej#10,13,16,19` | probable (destino) / supuesto (origen) |
| S10 | Guardamos por operación: tipo, monto, origen, destino, `anulada` (necesario para "ya anulada") | `ej#13,14` | probable |
| S11 | Qué consume cada fallo no listado (E401, E302, E301, E50x desconocidos) | - | supuesto: nada se consume; Q7 |
| S12 | ¿ALTA guarda el nombre? ¿Duplicados? ¿Límites de nombre? ¿Tope de cuentas? | - | supuesto: nombre sin efecto visible, duplicados permitidos; Q7 |
| S13 | Dependencia del tiempo (caducidad de token, ventana para anular, límites diarios) | - | supuesto: ninguna; Q12c |

### 1.4 Reglas de negocio visibles

- **E506 "límite excedido"** (`ej#9`): `TRANSFER;AC-0001;AC-0002;120000` con saldo del origen 210000
  (el saldo alcanzaba: no es E507). Pasan 40000 (`ej#7`) y 100000 (`ej#10`).
  Tres hipótesis compatibles con los tres puntos (más una pregunta lateral, H4):
  - **H1** tope por operación en `[100000, 119999]` (el valor exacto es desconocido);
  - **H2** acumulado transferido en la sesión con tope en `[140000, 159999]`: 40000 + 120000 = 160000 rechaza,
    40000 + 100000 = 140000 pasa;
  - **H3** proporción del saldo: 100000/210000 = 47,6% pasa, 120000/210000 = 57,1% rechaza (tope ~50%);
  - **H4** (pregunta lateral, no explica `ej#9`): ¿DEPOSITO tiene su propio tope E506? `ej#6` pasó con 250000,
    así que si existe es > 250000.
  Desempata Q4a/Q4b: con saldo 1.000.000, `TRANSFER 120000` sigue rechazado => H1 (o H2); aceptado => H3.
  Cuatro transferencias de ~100000 seguidas (acumulado ~400000) matan H2 si pasan.
- **E507 "saldo insuficiente"** (`ej#16`): TRANSFER 50000 con saldo del origen 40000. Si compara `monto > saldo`
  o `>=` es desconocido (Q4c: transferir exactamente el saldo).
- **ANULA** (`ej#13,14`): `ANULA;OP-0003` -> `200 {"ok":true,"anulada":"OP-0003"}`; repetida ->
  `200 {"ok":false,"motivo":"ya anulada"}`. **Un fallo de negocio puede ser 200 con `ok:false`**, no solo
  un E5xx. Qué pasa con OP inexistente/de depósito/si el destino ya gastó el dinero: Q6a/Q6b.
- **E401** (`ej#15`): `CONSULTA` de cuenta inexistente 404. Para DEPOSITO/TRANSFER con cuenta inexistente:
  supuesto E401 (Q4c, Q7).

### 1.5 Respuestas exactas por comando (camino feliz)

| Comando | Argumentos | Status | Cuerpo | Evidencia |
|---|---|---|---|---|
| `PING` | 0 | 200 | `{"pong":true}` | `ej#1` |
| `ALTA` | `nombre` (1) | 201 | `{"cuentaId":"AC-0001"}` | `ej#3,4`; con 2 args -> E302 (`ej#20`) |
| `CONSULTA` | `cuenta` (1) | 200 | `{"cuenta_id":"AC-0001","saldo":0}` | `ej#5,8,11,19` |
| `DEPOSITO` | `cuenta;monto` (2) | 200 | `{"status":"recieved","operacionId":"OP-0001"}` | `ej#6,18` |
| `TRANSFER` | `origen;destino;monto` (3) | 200 | `{"status":"recieved","operacionId":"OP-0002"}` | `ej#7,10` |
| `ANULA` | `operacion` (1) | 200 | `{"ok":true,"anulada":"OP-0003"}` / `{"ok":false,"motivo":"ya anulada"}` | `ej#13,14` |

Todo con confianza **probable** (una o dos observaciones, solo en ejemplos). La aridad "esperada" de
la columna 2 sale de los mensajes de los ejemplos, no de errores E302 observados salvo ALTA (Q9b).

### 1.6 Quirks que hay que reproducir (son requisitos, no bugs)

| ID | Quirk | Evidencia | Confianza |
|---|---|---|---|
| Q-01 | `"status":"recieved"` (typo) en DEPOSITO y TRANSFER | `ej#6,7,10,18` | probable |
| Q-02 | `E301` lleva **espacio final** en `mensaje`: `"comando desconocido "` | `ej#12` | probable (¿cola vacía de una plantilla?: Q9a) |
| Q-03 | Claves inconsistentes: `cuentaId` en ALTA vs `cuenta_id` en CONSULTA | `ej#3,5` | probable |
| Q-04 | Comando insensible a mayúsculas (`CONSULTa`) | `ej#11` | probable |
| Q-05 | Control sin ceros a la izquierda en la salida del cliente (`3`), y letras en minúscula pesan igual | `ej#4,3` | probable |
| Q-06 | `ANULA` repetida es 200 con `ok:false` (no un error HTTP) | `ej#14` | probable |
| Q-07 | ALTA responde **201**; DEPOSITO/TRANSFER **200** aunque creen una operación | `ej#3,6` | probable |
| Q-08 | E5xx en **422**, E401 en **404**, E2xx/E3xx en **400** | `ej#2,9,12,15,16,17,20` | probable |
| Q-09 | Mensajes con acentos UTF-8 (`inválido`, `límite`) | `ej#2,9` | probable |

### 1.7 Rutas, métodos y auth fuera de `/msg`

- Observado: `GET /health` **sin token** -> 401 E001 `{"error":"E001","mensaje":"no autorizado"}` (`log#1`, una
  vez). Es decir, `/health` **exige** token (la auth se evalúa al menos antes de esa ruta). Confianza: **probable** (una
  observación; no sabemos si vale para rutas inexistentes: Q3).
- Del contrato (`material/README.md`): `POST /msg`, `POST /__reset`, `GET /health`. Cuerpo de `/__reset` y de
  `/health` con token, token inválido (¿mismo E001?), rutas desconocidas, métodos incorrectos, cuerpos rotos:
  **sin datos** (Q3). Defecto del reemplazo = **supuesto**.
- `X-Req` (cabecera de respuesta registrada como `x_req` por `probe.py`): semántica desconocida (Q13).
  Los headers no se comparan en el set, así que solo importa si delata versión/estado.

### 1.8 Versiones durante el día

`ejemplos.jsonl` es la versión de la mañana; el set cuenta la versión de las 20:00. Detección: **canario** Q12 =
los 20 ejemplos + 4 bordes, ejecutado ahora (línea base) y cada hora; cualquier diferencia de status/cuerpo
contra la corrida anterior abre una investigación. Coste: 25 requests/ejecución ≈ 325 requests/día de 8.000.
Hipótesis de qué puede cambiar (todas **supuestos**): fórmula de control, mensajes de error, límite E506,
comandos nuevos, status codes, nuevos quirks. Cada experimento de la sección 3 debe repetirse tras un cambio.

---

## 2. Arquitectura del reemplazo

Lo más simple que reproduce el modelo. Sin base de datos, sin LLM, sin infraestructura adicional.

| Decisión | Elección | Por qué |
|---|---|---|
| Entrada | `app/[[...path]]/route.ts` (ya existe) exporta GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS y delega en `handle(method, path, auth, raw)` | Next no decide nada por su cuenta: `skipTrailingSlashRedirect`, sin 404 propio; cualquier ruta/método llega a `lib/service.ts` |
| Lógica | `lib/service.ts`: función **pura y síncrona** `handle(...) -> {status, body}` (`body` string => se envía como texto plano) | un handler sin `await` entre leer y escribir el estado elimina carreras; <1 ms por paso, muy por debajo de 5 s |
| Estado | `globalThis.__caja ??= new Map<token, Store>()` con `Store = {cuentas: Map<id,{nombre,saldo}>, ops: Map<id,{tipo,monto,origen,destino,anulada}>, siguienteAC, siguienteOP, ...}` | un solo proceso de larga vida; `globalThis` evita perder el estado por recargas de módulo en `next dev`. Sin DB (no hay evidencia de persistencia entre reinicios) |
| Reset | `POST /__reset` con token válido crea un `Store` nuevo | `ej#3`: AC-0001 tras reset; el set llama reset antes de cada test |
| Auth | solo `TEAM_TOKEN` (env). Otro token o ninguno => 401 E001 (`log#1`) | contrato del material; el cuerpo para token *inválido* es supuesto hasta Q3 |
| Runtime | `export const runtime = "nodejs"`, `dynamic = "force-dynamic"`; **no** edge/serverless | el edge/serverless reparte en instancias con estado distinto |
| Despliegue | Railway (o Render de pago / Fly con 1 máquina): `pnpm build && pnpm start`, **1 réplica**, sin autoscaling, sin sleep/scale-to-zero | el set le habla a un solo proceso; una cold start >5 s rompería un paso. Fijar `PORT` |
| Verificación | `tools/replay.py` (parity-verifier) contra `localhost:3000` reproduciendo los 20 ejemplos y, después, cada secuencia de la sección 3 con su resultado real | |

### Estructura interna de `handle()` (orden = hipótesis de 1.2; reordenar si Q2 lo contradice)

1. `auth`: `Authorization === "Bearer " + TEAM_TOKEN` o 401 E001.
2. Enrutado: `/health`, `/__reset`, `/msg`; el resto = respuesta de "ruta desconocida" (supuesto hasta Q3).
3. Cuerpo: JSON con `m` string (si no, el error que descubra Q3).
4. `payload, ctrl = m.rpartition(';')`; `ctrl` debe ser un entero (`E201` si no); comparar con `control(payload)` (`E202`).
   `control` = C1 de 1.1 en una pasada con `h = (h * 10^largo(v) + v) mod 97`, `v` = dígito o posición del alfabeto,
   tras `toUpperCase()`; el resto de caracteres no suma. La forma exacta de "entero" (ceros, `+`, espacios,
   `c+97`) y C1 vs C2 en los bordes: Q1a/Q1b.
5. `campos = payload.split(';')`; `cmd = campos[0].toUpperCase()` (E301 si no es uno de los 6; `mensaje` con espacio final);
   aridad por comando (E302).
6. Ejecutar el comando con sus reglas (E401, E506/E507...) y mutar el estado **solo si todo pasa** (los fallos no
   consumen contadores: S4, S5).
7. JSON con las claves tal cual (`cuentaId`, `cuenta_id`, `recieved`), `mensaje` con acentos y el espacio final de E301.

Portar la fórmula a TypeScript con **los mismos 20 casos** (`ejemplos.jsonl`) como test, más los bordes de Q1b
(`CONSULTA;AC-0038;0`, `CONSULTA;AC-0070;1`).

Riesgos de arquitectura: reinicio del proceso en medio del set (estado perdido; no mitigable sin DB, pero
`/__reset` precede cada test); latencia de arranque; rate-limit de la plataforma; HEAD/OPTIONS que Next responde
solo si no se exportan (ya exportados). Si alguna vez hay evidencia de persistencia (estado que sobrevive a
`/__reset`), reabrir la decisión de no usar DB.

---

## 3. Preguntas abiertas priorizadas (plan de recon-prober)

Convenciones: cada bloque es una secuencia para `python3 tools/probe.py seq <nombre> "<hipótesis>" <m1> <m2> ...`
(hace `/__reset` antes; **un token por explorador**) o, en Q3, una lista de `probe.py raw`. Los mensajes llevan el
control **calculado por C1** (`tools/analysis/control.py`); `python3 tools/analysis/plan.py probe Qx` imprime el
comando exacto. **Si aparece E202 donde el plan no lo espera, la fórmula (C1) o el mapeo de caracteres (Q8) está
mal: detener la tanda, concluir en el log y consultar a system-designer.** Presupuesto: ~290 mensajes en total (incluida una ejecución del canario; cada `seq` suma un `/__reset`) + 25 por
canario (8.000/día/token). Después de cada tanda, `probe.py concluir <id> "<texto>"` solo con lo que esa línea prueba.

Orden recomendado: Q12 (línea base) -> Q1a -> Q1b -> Q2 -> Q3 -> Q8a -> Q9b -> Q10 -> Q5 -> Q4a/b/c -> Q6a/b -> Q7 -> Q9a -> Q11 -> Q13 -> Q12c -> Q14.

### P0: gobierna casi todos los tests (40 son de un solo request)

#### Q1a - Forma del campo de control (E201 vs E202 vs aceptado)

- **Hipótesis**: (a) el control es "cualquier cadena de dígitos" (`064`, `+64`, `64.0` y `161` pasan/fallan distinto), (b) PING no valida
  el control (`PING;65` -> pong), (c) falta de `;` / control vacío -> E201 o E302 o E1xx.
- **Predicciones C1 estricto + regex `^\d+$`**: `PING;64` pong; `PING;65` E202; `PING;XX`, `PING;`, `PING;64.0`, `PING;+64`, `PING;-33`,
  `PING; 64`, `PING;64 ` E201; `PING;064` y `PING;0064` pong (si parsea con `int`) o E201 / E202 (si no); `PING;161` E202 (estricto)
  o pong (congruencia); `PING` (sin `;`), `;64`, `64`: ?
- **Afecta al reemplazo**: parser de control (C3/C4), qué es E201.

```
PING;64
PING;65
PING;XX
PING;
PING
PING;064
PING;0064
PING;+64
PING; 64
PING;64 
PING;161
PING;-33
PING;64.0
PING;64;
;64
64
```

`python3 tools/analysis/plan.py probe Q1a` -> secuencia `q1a-control-forma`.

#### Q1b - C1 vs C2 vs congruencia en los bordes (el desempate de la fórmula)

- Los payloads cuyo C1 vale 0, 1, 2 son `CONSULTA;AC-0038`, `CONSULTA;AC-0070`, `CONSULTA;AC-0005`; son cuentas que no existen, así que un control
  aceptado da **404 E401** y uno rechazado **400 E202**.
- **C1 estricto**: `;0`, `;1`, `;2` -> E401; `;97`, `;98`, `;99` -> E202.
  **C2**: `;97`, `;98` -> E401 y `;0`, `;1` -> E202; `;2` -> E401 y `;99` -> E202 (igual que C1 en este payload).
  **C3 (congruencia)**: los seis -> E401.

```
CONSULTA;AC-0038;0
CONSULTA;AC-0038;97
CONSULTA;AC-0070;1
CONSULTA;AC-0070;98
CONSULTA;AC-0005;2
CONSULTA;AC-0005;99
```

`python3 tools/analysis/plan.py probe Q1b` -> secuencia `q1b-control-borde`.

#### Q2 - Precedencia de la tubería (control / comando / aridad / entidad)

- Cada mensaje rompe **dos** cosas. El primer error que aparezca dice quién va primero:
  `SALDOS;AC-0001;<mal>`: E202 (control antes que comando) vs E301; `...;5X` ídem con E201; `ALTA;Lucia;Gomez;<mal>`: control vs aridad;
  `CONSULTA;AC-0009;<mal>`: control vs entidad; `CONSULTA;<c>` y `FOO;<c>`: aridad/comando con control correcto;
  `SALDOS;AC-0001` (sin control: el último campo hace de control): ¿E201?, ¿E301?
- Con `ALTA;Lucia` al inicio para que AC-0001 exista.

```
ALTA;Lucia;82
SALDOS;AC-0001;45
SALDOS;AC-0001;5X
SALDOS;AC-0001
ALTA;Lucia;Gomez;18
ALTA;Lucia;Gomez;5X
CONSULTA;AC-0009;94
CONSULTA;AC-0009;5X
CONSULTA;18
CONSULTA;11
FOO;54
FOO;47
```

`python3 tools/analysis/plan.py probe Q2` -> secuencia `q2-precedencia`.

#### Q3 - Entrada: rutas, métodos, cuerpo y auth

- **Hipótesis**: sin token siempre E001 (también en `/nada`, `/msg`, `/__reset`); token inválido = mismo E001; cuerpo sin `m` -> error E1xx;
  rutas desconocidas -> ¿404 JSON, 404 texto (Express "Cannot GET /nada"), o E-algo?; métodos incorrectos -> 404/405; `/__reset` -> 200 con
  cuerpo ?, `/health` con token -> 200 ?. Si alguna respuesta no es JSON, **anotar el texto exacto** (se compara carácter por carácter).
  Los status y cuerpos exactos van a la spec (sección Entrada). Ejecutar con `CAJA_TOKEN` válido; las líneas con `--no-auth`/`--token` prueban auth.

```
POST    /msg                                              # cuerpo vacío
POST    /msg                   {                          # JSON roto
POST    /msg                   []                         # array en vez de objeto
POST    /msg                   {}                         # sin m
POST    /msg                   {"m":5}                    # m no string
POST    /msg                   {"m":null}                 # m null
POST    /msg                   {"m":""}                   # m vacío
POST    /msg                   {"M":"PING;64"}            # clave en mayúscula
POST    /msg                   {"m":"PING;64","x":1}      # clave extra
POST    /msg                   "PING;64"                  # string JSON
POST    /msg                   m=PING;64                  # form
GET     /msg                   (sin cuerpo)               # GET /msg
PUT     /msg                   {"m":"PING;64"}            # PUT /msg
OPTIONS /msg                   (sin cuerpo)               # OPTIONS /msg
POST    /msg/                  {"m":"PING;64"}            # slash final
POST    /MSG                   {"m":"PING;64"}            # mayúsculas en la ruta
POST    /msg?x=1               {"m":"PING;64"}            # query string
GET     /health                (sin cuerpo)               # con token
POST    /health                (sin cuerpo)               # método incorrecto
GET     /__reset               (sin cuerpo)               # GET en la ruta de reset
POST    /__reset               (sin cuerpo)               # forma del cuerpo de /__reset
GET     /                      (sin cuerpo)               # raíz con token
GET     /nada                  (sin cuerpo)               # ruta inexistente con token
POST    /nada                  {"m":"PING;64"}            # POST a ruta inexistente
GET     /nada --no-auth        (sin cuerpo)               # ruta inexistente SIN token
POST    /msg --no-auth         {"m":"PING;64"}            # /msg sin token
POST    /__reset --no-auth     (sin cuerpo)               # reset sin token
POST    /msg --token invalido  {"m":"PING;64"}            # token inválido (¿mismo E001?)
GET     /health --token invalido (sin cuerpo)               # health con token inválido
```

`python3 tools/analysis/plan.py probe Q3` -> secuencia `q3-entrada`.

### P1: reglas de negocio y gramática (las 45 secuencias de 2-5 pasos las usan)

#### Q8a / Q8b - Qué hacen los caracteres no alfanuméricos en el control (prerrequisito de Q5)

- **W0** (C1): se ignoran todos. Si `CONSULTA;A<x>B` da E401 => `x` se ignora; si da E202 => `x` pesa algo (p. ej. su código, o unicode raro).
  Para cada `x` con E202, **barrer** Q8b: `CONSULTA;AxB;<c>` con `c` en 0..98, anotar el único `c` que da E401 y deducir
  `3N mod 97` (=> valor de `x`).
- Importa porque `-5`, `10.5`, `1,000`, `+100` y los nombres con espacio/acento dependen de esto.

```
CONSULTA;A B;92
CONSULTA;A.B;92
CONSULTA;A_B;92
CONSULTA;A,B;92
CONSULTA;A+B;92
CONSULTA;A/B;92
CONSULTA;A#B;92
CONSULTA;AñB;92
CONSULTA;AéB;92
CONSULTA;A€B;92
CONSULTA;AB;92
```

`python3 tools/analysis/plan.py probe Q8a` -> secuencia `q8a-caracteres-control`.

#### Q9b - Aridad de cada comando

- Cada comando con n-1 y n+1 argumentos (con `AC-0001` de relleno): E302 vs otro código; ¿`PING;AC-0001` pasa? (hipótesis "PING ignora argumentos").
  Fijar la tabla de aridades exactas.

```
ALTA;Lucia;82
PING;AC-0001;87
PING;AC-0001;AC-0001;29
ALTA;85
ALTA;AC-0001;AC-0001;12
CONSULTA;11
CONSULTA;AC-0001;AC-0001;95
DEPOSITO;25
DEPOSITO;AC-0001;4
DEPOSITO;AC-0001;AC-0001;AC-0001;36
TRANSFER;89
TRANSFER;AC-0001;83
TRANSFER;AC-0001;AC-0001;18
TRANSFER;AC-0001;AC-0001;AC-0001;AC-0001;57
ANULA;45
ANULA;AC-0001;AC-0001;49
```

`python3 tools/analysis/plan.py probe Q9b` -> secuencia `q9b-aridad`.

#### Q10 - ¿Idempotencia? Mensajes idénticos repetidos

- **Hipótesis**: (a) cada DEPOSITO crea una OP nueva (`OP-0001`, `OP-0002`, saldo 1400); (b) el servicio deduplica por mensaje (misma `OP-0001`, saldo 700).

```
ALTA;Lucia;82
DEPOSITO;AC-0001;700;28
DEPOSITO;AC-0001;700;28
CONSULTA;AC-0001;14
CONSULTA;AC-0001;14
```

`python3 tools/analysis/plan.py probe Q10` -> secuencia `q10-idempotencia`.

#### Q5 - Gramática del monto

- **Preguntas**: ¿qué es un monto válido? ¿cero, negativo, decimal, notación científica, ceros a la izquierda, signos, espacios,
  separadores, desbordes? ¿qué E50x o E3xx devuelve cada uno? ¿`0100` se guarda como 100? (el `CONSULTA` tras cada depósito lo ve).
  Hallar E501-E505. Un `E202` aquí significa que falló Q8 para ese carácter, no que el monto sea inválido.

```
ALTA;Lucia;82
DEPOSITO;AC-0001;0;31
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;-5;16
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;10.5;67
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;abc;13
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;;4
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;1e3;20
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;0100;19
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;+100;82
CONSULTA;AC-0001;14
DEPOSITO;AC-0001; 100;82
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;100 ;82
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;1,000;35
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;007;70
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;9007199254740993;88
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;99999999999999999999;4
CONSULTA;AC-0001;14
```

`python3 tools/analysis/plan.py probe Q5` -> secuencia `q5-gramatica-monto`.

#### Q4a - ¿DEPOSITO tiene límite?

- 250000 pasa (`ej#6`). Probar 1.000.000, 10.000.000 y 100.000.000: ¿E506? ¿otro? El `CONSULTA` final dice cuáles se aplicaron.

```
ALTA;Lucia;82
DEPOSITO;AC-0001;250000;86
DEPOSITO;AC-0001;1000000;51
DEPOSITO;AC-0001;10000000;16
DEPOSITO;AC-0001;100000000;54
CONSULTA;AC-0001;14
```

`python3 tools/analysis/plan.py probe Q4a` -> secuencia `q4a-deposito-limite`.

#### Q4b - Naturaleza de E506 (H1 tope por operación / H2 acumulado / H3 proporción del saldo)

- Saldo de AC-0001 = 1.000.006 (4 depósitos distintos), AC-0002 = 0.
- `TRANSFER 120000` (saldo 1M): **rechazado => H1 o H2**; aceptado => H3 (o límite aún más alto).
- `100001`, `110000`, `119999`: acotan el tope por operación en [100000, 119999] (H1). Las siguientes (100000, 99999, 99998, 99997) son
  cuatro transferencias seguidas: el acumulado queda en ~400000 y **si todas pasan, H2 (tope acumulado ≤ 159999) queda refutada**.
- Si H1: el tope exacto sale del primer `100001`..`119999` que falle (afinar con búsqueda binaria, ~5 requests más).

```
ALTA;Lucia;82
ALTA;Mateo;3
DEPOSITO;AC-0001;250000;86
DEPOSITO;AC-0001;250001;83
DEPOSITO;AC-0001;250002;80
DEPOSITO;AC-0001;250003;77
CONSULTA;AC-0001;14
TRANSFER;AC-0001;AC-0002;120000;55
TRANSFER;AC-0001;AC-0002;100001;9
TRANSFER;AC-0001;AC-0002;110000;82
TRANSFER;AC-0001;AC-0002;119999;58
TRANSFER;AC-0001;AC-0002;100000;12
TRANSFER;AC-0001;AC-0002;99999;24
TRANSFER;AC-0001;AC-0002;99998;27
TRANSFER;AC-0001;AC-0002;99997;30
CONSULTA;AC-0001;14
CONSULTA;AC-0002;11
```

`python3 tools/analysis/plan.py probe Q4b` -> secuencia `q4b-limite-transfer`.

#### Q4c - Precedencia dentro de TRANSFER y casos borde

- Con AC-0001 = 50000 y AC-0002 = 0: `500000` (límite + saldo): E506 vs E507 => **quién va primero**; destino inexistente + saldo / + límite =>
  E401 vs E50x; origen inexistente; ambas; **misma cuenta** (¿E50x? ¿pasa y no cambia nada?); `0`; el saldo final dice qué se aplicó.
- Falta (añadir tras ver los resultados): transferir exactamente el saldo (`50000`) => `>` vs `>=` en E507.

```
ALTA;Lucia;82
ALTA;Mateo;3
DEPOSITO;AC-0001;50000;39
TRANSFER;AC-0001;AC-0002;500000;96
TRANSFER;AC-0001;AC-0009;60000;82
TRANSFER;AC-0001;AC-0009;500000;14
TRANSFER;AC-0009;AC-0002;1000;25
TRANSFER;AC-0009;AC-0008;1000;57
TRANSFER;AC-0001;AC-0001;1000;64
TRANSFER;AC-0001;AC-0001;60000;11
TRANSFER;AC-0001;AC-0002;0;44
CONSULTA;AC-0001;14
CONSULTA;AC-0002;11
```

`python3 tools/analysis/plan.py probe Q4c` -> secuencia `q4c-transfer-precedencia`.

#### Q6a - ANULA de un DEPOSITO y errores de ANULA

- ¿Revierte el depósito (saldo 0)? ¿OP inexistente (`OP-0099`), mal formada (`OP-1`, `op-0001`), de otro tipo (`AC-0001`), sin argumento, con 2
  argumentos? ¿200 `ok:false` con otro `motivo`, o E4xx/E5xx? Tras anular, el saldo y que `DEPOSITO` siguiente dé `OP-0002`.

```
ALTA;Lucia;82
DEPOSITO;AC-0001;1000;35
ANULA;OP-0001;72
CONSULTA;AC-0001;14
ANULA;OP-0001;72
ANULA;OP-0099;69
ANULA;OP-1;91
ANULA;op-0001;72
ANULA;AC-0001;59
ANULA;;45
ANULA;45
ANULA;OP-0001;OP-0002;25
DEPOSITO;AC-0001;5;16
CONSULTA;AC-0001;14
```

`python3 tools/analysis/plan.py probe Q6a` -> secuencia `q6a-anula-deposito`.

#### Q6b - ANULA de una TRANSFER cuyo destino ya gastó el dinero

- Origen vuelve a tener su dinero? (en `ej#13` solo vimos el destino; esta secuencia consulta **ambos**). Destino con 100 y anulación de 400 =>
  ¿E507? ¿saldo negativo? ¿`ok:false`? El segundo `ANULA;OP-0003` (transfer de vuelta) y de nuevo OP-0002 comprueba el orden.

```
ALTA;Lucia;82
ALTA;Mateo;3
DEPOSITO;AC-0001;1000;35
TRANSFER;AC-0001;AC-0002;400;94
TRANSFER;AC-0002;AC-0001;300;91
ANULA;OP-0002;69
CONSULTA;AC-0001;14
CONSULTA;AC-0002;11
ANULA;OP-0003;66
ANULA;OP-0002;69
CONSULTA;AC-0001;14
CONSULTA;AC-0002;11
```

`python3 tools/analysis/plan.py probe Q6b` -> secuencia `q6b-anula-transfer-gastada`.

#### Q7 - Contadores tras fallos y ALTA

- ALTA duplicado (`Lucia`, `Lucia`: ¿AC-0002 o error?), `ALTA;Lucia;Gomez` (E302) y luego `ALTA;Ana`: ¿AC-0003 o AC-0002 (E302 no consume)?
  DEPOSITO/TRANSFER a cuenta inexistente y el OP siguiente. Nombres vacío / `ANA` vs `ana` / de 200 letras.

```
ALTA;Lucia;82
ALTA;Lucia;82
ALTA;Lucia;Gomez;11
ALTA;Ana;50
DEPOSITO;AC-0099;100;89
DEPOSITO;AC-0001;100;82
TRANSFER;AC-0001;AC-0099;1;41
DEPOSITO;AC-0001;1;28
ALTA;;85
ALTA;;;85
ALTA;ANA;50
ALTA;lucia;82
ALTA;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA;53
```

`python3 tools/analysis/plan.py probe Q7` -> secuencia `q7-contadores-y-fallos`.

#### Q9a - Comandos desconocidos y ocultos

- ¿El `mensaje` de E301 es siempre `"comando desconocido "` o depende del comando (`FOO`, vacío)? Cualquier respuesta que no sea 400 E301 es un comando
  oculto: documentarlo y pedir a fuzzer que lo explore. También `ping` en minúscula (esperado: pong), `PING ` y ` PING` (espacios).

```
FOO;47
;1
ping;64
PING ;64
 PING;64
SALDO;38
BALANCE;57
SALDOS;55
HELP;72
AYUDA;0
VERSION;86
VER;56
STATUS;8
ESTADO;28
HISTORIAL;13
LISTA;9
CUENTAS;87
CUENTA;81
BAJA;39
RETIRO;83
RETIRAR;44
DEBITO;4
CREDITO;40
ECHO;61
TIME;89
HORA;22
RESET;34
INFO;92
OPERACIONES;18
OP;12
CONSULTAR;74
ANULAR;79
REVERSA;64
REVERTIR;71
DEPOSITAR;46
TRANSFERIR;81
TRANSFERENCIA;49
LIMITE;95
LIMITES;32
CLOSE;59
CIERRE;10
DUMP;12
STATS;93
ADMIN;69
DEBUG;89
MODIFICA;89
BORRA;25
ELIMINA;68
```

`python3 tools/analysis/plan.py probe Q9a` -> secuencia `q9a-comandos-desconocidos`.

### P2

#### Q11 - Forma de los IDs de cuenta

```
ALTA;Lucia;82
CONSULTA;ac-0001;14
CONSULTA;AC-1;5
CONSULTA;AC-00001;61
CONSULTA;AC0001;14
CONSULTA;AC-0001 ;14
CONSULTA; AC-0001;14
CONSULTA;AC-0001-;14
```

`python3 tools/analysis/plan.py probe Q11` -> secuencia `q11-ids-forma`.

#### Q13 - `X-Req`

- Leer `x_req` de cada línea del log: ¿contador por token? ¿se reinicia con `/__reset`? ¿cuentan los errores?

```
PING;64
PING;64
PING;71
PING;64
```

`python3 tools/analysis/plan.py probe Q13` -> secuencia `q13-xreq`.

#### Q12c - ¿El tiempo importa?

- Insertar una espera real de 60 s entre `DEPOSITO` y `ANULA`; repetir con 5 min. Cualquier diferencia respecto a la misma secuencia sin espera
  indica dependencia del tiempo. (Es el único experimento con espera: ejecutarlo en segundo plano con un token propio.)

```
ALTA;Lucia;82
DEPOSITO;AC-0001;1000;35
<esperar 60 s>
ANULA;OP-0001;72
CONSULTA;AC-0001;14
```

`python3 tools/analysis/plan.py probe Q12c` -> secuencia `q12-timer-anula`.

#### Q12 - Canario de versión (línea base ahora; repetir cada hora hasta las 20:00)

- Los 20 ejemplos en orden + `PING;65`, `CONSULTA;AC-0038;0`, `CONSULTA;AC-0038;97` y `CONSULTA;AC-0001;AC-0002;<c>` (aridad). Comparar con
  `ejemplos.jsonl` y con la ejecución anterior (diff de status+cuerpo). Cada diferencia => `probe.py concluir` y avisar a system-designer.

```
PING;64
ALTA;Lucia;83
ALTA;Lucia;82
ALTA;Mateo;3
CONSULTA;AC-0001;14
DEPOSITO;AC-0001;250000;86
TRANSFER;AC-0001;AC-0002;40000;86
CONSULTA;AC-0002;11
TRANSFER;AC-0001;AC-0002;120000;55
TRANSFER;AC-0001;AC-0002;100000;12
CONSULTa;AC-0001;14
SALDOS;AC-0001;38
ANULA;OP-0003;66
ANULA;OP-0003;66
CONSULTA;AC-0009;87
TRANSFER;AC-0002;AC-0001;50000;23
DEPOSITO;AC-0002;700;5X
DEPOSITO;AC-0002;700;35
CONSULTA;AC-0002;11
ALTA;Lucia;Gomez;11
PING;65
CONSULTA;AC-0038;0
CONSULTA;AC-0038;97
CONSULTA;AC-0001;AC-0002;92
```

`python3 tools/analysis/plan.py probe Q12` -> secuencia `canario`.

### P3

#### Q14 - Tamaños y unicode

```
ALTA;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA;53
ALTA;Ñandú;41
ALTA;Ana
López;86
```

`python3 tools/analysis/plan.py probe Q14` -> secuencia `q14-tamanos`.

---

## 4. Lo que NO sabemos aunque suene a hecho

- Que el control sea C1 y no C2/C3 **en los bordes**; que los caracteres distintos de `;` y `-` se ignoren.
- Que el orden de la tubería sea el de la numeración.
- Que E506 sea un tope por operación (H1): hay tres explicaciones compatibles.
- Que ANULA devuelva el dinero al **origen**.
- Cualquier respuesta a rutas/métodos/cuerpos no `{"m": ...}`.
- Que el servicio de las 20:00 sea el de los ejemplos.
