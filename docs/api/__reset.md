# POST /__reset

> Documentación del repositorio. **El reemplazo no sirve este archivo** (cualquier ruta inexistente responde 404 E404).
> Fuente: `spec/especificacion.md` (log ids 1-731) y `lib/service.ts`. Definición OpenAPI: [`openapi.yaml`](../../openapi.yaml) (`/__reset`).

## Método y ruta

`POST /__reset`. `GET /__reset` es **404 E404** (id 45). Lo llama el evaluador antes de cada test.

## Autenticación

Exige `Authorization: Bearer <token>` (ENT-4). Sin token / inválido / esquema distinto -> **401**
`{"error":"E001","mensaje":"no autorizado"}` (id 70 sin token). Auth se evalúa después del ruteo.

## Request

- No necesita cuerpo (la mayoría de las pruebas no lo llevan).
- Con query `?x=1` (id 618) y con un cuerpo de ~8300 bytes (id 577) responde igual: una muestra cada uno (probable). El límite de 8192 bytes de `/msg` no aplica.

## Respuestas

| Status | Cuerpo exacto | Cuándo |
|---|---|---|
| 200 | `{"ok":true}` | Token válido. Sin header `X-Req`; no cuenta para `X-Req`. |
| 401 | `{"error":"E001","mensaje":"no autorizado"}` | Sin token, token inválido o esquema distinto de `Bearer` exacto. |
| 404 | `{"error":"E404","mensaje":"ruta desconocida"}` | Otro método (p. ej. `GET /__reset`) o variantes de ruta. |

## Orden de evaluación

1. Ruteo -> 404 E404. 2. Auth -> 401 E001. 3. Reset -> 200 (ERR-15, ERR-29).

## Estado / memoria que afecta

- **Borra** cuentas y operaciones y **reinicia** los contadores `AC-` y `OP-`: tras el reset, `ALTA` vuelve a dar `AC-0001` (saldo 0) y el primer `DEPOSITO`/`TRANSFER` vuelve a dar `OP-0001` (MEM-4).
- **No reinicia el contador `X-Req`** del header de `/msg`: el primer `/msg` posterior continúa la cuenta (MEM-2).
- Desconocido: si algo más sobrevive al reset aparte de `X-Req`.
- El reemplazo mantiene un único estado (el del token del equipo); el original dice tener estado por token (no probado).

## Ejemplos curl

```bash
BASE=https://lab10-caja-negra.vercel.app
TOKEN=<token del equipo>

# 200 {"ok":true}
curl -i -X POST -H "Authorization: Bearer $TOKEN" "$BASE/__reset"

# 401 {"error":"E001","mensaje":"no autorizado"}
curl -i -X POST "$BASE/__reset"

# 404 {"error":"E404","mensaje":"ruta desconocida"}  (método incorrecto)
curl -i -H "Authorization: Bearer $TOKEN" "$BASE/__reset"
```

## Filas de la spec

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| ENT-1 | Las únicas combinaciones ruta+método con comportamiento propio son `GET /health`, `POST /__reset` y `POST /msg`. Todo lo demás cae en ENT-6. | 2, 3, 4 (las tres válidas); 35, 44, 45, 89, 90, 91, 92 (otros métodos sobre ellas = 404); 93, 614, 615 (HEAD = 404, ENT-9) | confirmado |
| ENT-3 | `POST /__reset` con token válido: **200** `{"ok":true}`, sin header `X-Req`. Sin cuerpo en la mayoría de las pruebas; con query `?x=1` (618) y con un cuerpo de ≈8300 bytes (577, no le aplica el límite de ENT-14) responde igual (una muestra cada uno: probable). | 3, 24, 47, 76, 107, 122, 129; 577, 618 | confirmado (sin cuerpo) / probable (query, cuerpo grande) |
| ENT-4 | Autenticación = header `Authorization: Bearer <token>`. Cualquiera de estos casos da **401** `{"error":"E001","mensaje":"no autorizado"}`, siempre el mismo cuerpo (no distingue "falta" de "inválido"): sin header, `Bearer ` vacío, token inventado, esquema `Basic`, esquema `bearer` en minúscula, y también `bearer <token válido>` y `Basic <token válido>` (el esquema se compara exacto: solo `Bearer`). Aplica a `GET /health`, `POST /msg` y `POST /__reset`: las tres exigen token (incluido `/health`). | `/health`: 1, 95, 96, 97, 98, 425 (`bearer` + token válido), 427 (`Basic` + token válido); `/msg`: 37, 38, 71, 94, 99, 100, 101, 102, 426 (`bearer` + token válido), 428 (`Basic` + token válido); `/__reset`: 70 | confirmado |
| ENT-19 | El query string se ignora en el ruteo: `POST /msg?x=1` se procesa (200 `{"pong":true}`, cuenta `X-Req`=519), `GET /health?x=1` → 200 `{"ok":true}`, `POST /__reset?x=1` → 200 `{"ok":true}`. Una muestra por ruta. | 612, 616, 618 | probable |
| ENT-20 | El límite de ENT-14 solo aplica a `POST /msg` autenticado: `GET /health` y `POST /__reset` con token y cuerpo de ≈8300 bytes responden 200 `{"ok":true}` (una muestra cada uno). | 576, 577 | probable |
| MEM-2 | `/__reset` **no** reinicia `X-Req` (el primer `/msg` tras un reset continúa la cuenta). | 24, 25 (21 tras 1..20); 47, 48 (36); 107, 108 (68); 129, 130 (88); 340 (286); 612, 620 (519 → 520 con el reset 619 en medio); 634, 636 (534 → 535 con el reset 635 en medio) | confirmado |
| MEM-3 | No cuentan ni llevan `X-Req`: `GET /health`, `POST /__reset`, las respuestas 404 y los 401. | 24, 27, 29, 35, 37, 38, 44, 45; 39 (X-Req=30 tras dos 401); 46 (35 tras 404s y health); 567-569 (401), 574-578 (404 y 200 con cuerpo grande), 611, 613 (404), 614, 615 (HEAD), 616-618 (health/reset con query): x_req null | confirmado |
| MEM-4 | `POST /__reset` borra cuentas y operaciones y reinicia los contadores AC y OP: tras él, `ALTA` vuelve a dar `AC-0001` y esa cuenta tiene saldo 0, aunque antes del reset AC-0001 tenía 110000 y existía AC-0002; el primer DEPOSITO vuelve a dar `OP-0001`. | 14 (110000 antes), 108 (AC-0001), 109 (saldo 0), 130, 186 (OP-0001), 236 (OP-0001) | confirmado |
| ERR-1 | **E001** · 401 · `{"error":"E001","mensaje":"no autorizado"}` — token ausente, vacío, inválido o con esquema distinto de `Bearer` (ENT-4). | 1, 37, 38, 70, 71, 94, 95, 96, 97, 98, 99, 100, 101, 102, 425, 426, 427, 428; con cuerpo de ≈8300 bytes (401 y no 413): 567, 568, 569 | confirmado |
| ERR-15 | **Orden 1-2**: ruteo (ruta+método → E404) antes que autenticación (E001). Un 404 gana contra un 401 con o sin token válido. | 69, 72, 73, 89, 90, 91, 92, 103, 104, 105, 106 | confirmado |
| RIE-10 | **Estado solo en memoria y borrable con un único request** (`POST /__reset` con el token): un reinicio o un reset accidental pierde todas las cuentas y operaciones sin rastro, y los contadores AC/OP vuelven a 1 (ids reutilizados). Cierre: persistencia + auditoría, y `/__reset` solo en entornos de prueba. | 3, 14, 108, 109 | confirmado |

## Notas sobre el reemplazo (`lib/service.ts`)

- `S.store = newStore()` reemplaza cuentas, operaciones y contadores `nextAC`/`nextOP`; `S.xreq` no se toca (coincide con MEM-2).
