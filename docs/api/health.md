# GET /health

> Documentación del repositorio. **El reemplazo no sirve este archivo** (cualquier ruta inexistente responde 404 E404).
> Fuente: `spec/especificacion.md` (log ids 1-731) y `lib/service.ts`. Definición OpenAPI: [`openapi.yaml`](../../openapi.yaml) (`/health`).

## Método y ruta

`GET /health`. Es la única ruta+método con este comportamiento; `POST /health`, `HEAD /health`, `GET /health/`, `GET /HEALTH`
son **404 E404** (ENT-1, ENT-7, ENT-8, ENT-9).

## Autenticación

Exige `Authorization: Bearer <token>`, **incluido `/health`** (ENT-4, RIE-8). Sin header, `Bearer ` vacío, token inventado,
esquema `Basic` o `bearer` en minúscula (también con token válido) -> **401** `{"error":"E001","mensaje":"no autorizado"}`.

## Request

- Sin cuerpo necesario. El query string se ignora (`GET /health?x=1` -> 200; una muestra: probable).
- El límite de 8192 bytes de `/msg` no aplica: con cuerpo de ~8300 bytes responde 200 (una muestra: probable).
- Desconocido: `GET /health` con un cuerpo pequeño (no probado).

## Respuestas

| Status | Cuerpo exacto | Cuándo |
|---|---|---|
| 200 | `{"ok":true}` | Token válido. Sin header `X-Req`; no cuenta para `X-Req`. |
| 401 | `{"error":"E001","mensaje":"no autorizado"}` | Sin token, token inválido o esquema distinto de `Bearer` exacto. |
| 404 | `{"error":"E404","mensaje":"ruta desconocida"}` | Otros métodos sobre `/health`, `/health/`, `/HEALTH` (ver [rutas-inexistentes.md](rutas-inexistentes.md)). `HEAD`: cuerpo vacío. |

## Orden de evaluación

1. Ruteo (ruta + método exactos) -> si no coincide, 404 E404 (con o sin token).
2. Autenticación -> 401 E001.
3. 200 `{"ok":true}`.

(ERR-15, ERR-29.)

## Estado / memoria

No lee ni modifica estado. No cuenta para `X-Req` (MEM-3). No tiene efecto sobre cuentas/operaciones.

## Ejemplos curl

```bash
BASE=https://lab10-caja-negra.vercel.app
TOKEN=<token del equipo>

# 200 {"ok":true}
curl -i -H "Authorization: Bearer $TOKEN" "$BASE/health"

# 401 {"error":"E001","mensaje":"no autorizado"}  (sin token)
curl -i "$BASE/health"

# 401 (esquema en minúscula, incluso con token válido)
curl -i -H "Authorization: bearer $TOKEN" "$BASE/health"

# 404 {"error":"E404","mensaje":"ruta desconocida"}  (barra final)
curl -i -H "Authorization: Bearer $TOKEN" "$BASE/health/"

# 404 con cuerpo vacío (HEAD no soportado)
curl -i -I -H "Authorization: Bearer $TOKEN" "$BASE/health"
```

## Filas de la spec

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| ENT-1 | Las únicas combinaciones ruta+método con comportamiento propio son `GET /health`, `POST /__reset` y `POST /msg`. Todo lo demás cae en ENT-6. | 2, 3, 4 (las tres válidas); 35, 44, 45, 89, 90, 91, 92 (otros métodos sobre ellas = 404); 93, 614, 615 (HEAD = 404, ENT-9) | confirmado |
| ENT-2 | `GET /health` con token válido: **200** `{"ok":true}`. Sin header `X-Req` y no cuenta para `X-Req`. | 2, 27 | confirmado |
| ENT-4 | Autenticación = header `Authorization: Bearer <token>`. Cualquiera de estos casos da **401** `{"error":"E001","mensaje":"no autorizado"}`, siempre el mismo cuerpo (no distingue "falta" de "inválido"): sin header, `Bearer ` vacío, token inventado, esquema `Basic`, esquema `bearer` en minúscula, y también `bearer <token válido>` y `Basic <token válido>` (el esquema se compara exacto: solo `Bearer`). Aplica a `GET /health`, `POST /msg` y `POST /__reset`: las tres exigen token (incluido `/health`). | `/health`: 1, 95, 96, 97, 98, 425 (`bearer` + token válido), 427 (`Basic` + token válido); `/msg`: 37, 38, 71, 94, 99, 100, 101, 102, 426 (`bearer` + token válido), 428 (`Basic` + token válido); `/__reset`: 70 | confirmado |
| ENT-7 | El ruteo distingue mayúsculas: `GET /HEALTH` es 404 E404 (no es `/health`), sin token (77) y con token **inválido** (105); `POST /MSG` con token válido también es 404 E404 y no cuenta `X-Req` (613). (No se probó `GET /HEALTH` con token válido.) | 77, 105, 613 | confirmado |
| ENT-8 | El ruteo no normaliza la barra final: `GET /health/` es 404 E404 sin token (75) y con token válido (617); `POST /msg/` con token válido también (611, sin `X-Req`). | 75, 617, 611 | confirmado |
| ENT-9 | `HEAD` no está soportado: `HEAD /msg` sin token (93), `HEAD /msg` con token válido (615) y `HEAD /health` con token válido (614) dan status **404** con cuerpo vacío (`""`), sin `X-Req`. No se probó `HEAD` sobre `/__reset`, sobre rutas inexistentes ni con token inválido. | 93, 615 (`/msg`); 614 (`/health`) | confirmado (`HEAD /msg`) / probable (`HEAD /health`) |
| ENT-19 | El query string se ignora en el ruteo: `POST /msg?x=1` se procesa (200 `{"pong":true}`, cuenta `X-Req`=519), `GET /health?x=1` → 200 `{"ok":true}`, `POST /__reset?x=1` → 200 `{"ok":true}`. Una muestra por ruta. | 612, 616, 618 | probable |
| ENT-20 | El límite de ENT-14 solo aplica a `POST /msg` autenticado: `GET /health` y `POST /__reset` con token y cuerpo de ≈8300 bytes responden 200 `{"ok":true}` (una muestra cada uno). | 576, 577 | probable |
| MEM-3 | No cuentan ni llevan `X-Req`: `GET /health`, `POST /__reset`, las respuestas 404 y los 401. | 24, 27, 29, 35, 37, 38, 44, 45; 39 (X-Req=30 tras dos 401); 46 (35 tras 404s y health); 567-569 (401), 574-578 (404 y 200 con cuerpo grande), 611, 613 (404), 614, 615 (HEAD), 616-618 (health/reset con query): x_req null | confirmado |
| ERR-1 | **E001** · 401 · `{"error":"E001","mensaje":"no autorizado"}` — token ausente, vacío, inválido o con esquema distinto de `Bearer` (ENT-4). | 1, 37, 38, 70, 71, 94, 95, 96, 97, 98, 99, 100, 101, 102, 425, 426, 427, 428; con cuerpo de ≈8300 bytes (401 y no 413): 567, 568, 569 | confirmado |
| ERR-2 | **E404** · 404 · `{"error":"E404","mensaje":"ruta desconocida"}` — ruta o método no soportados (ENT-6). Con `HEAD` el status es el mismo pero el cuerpo es vacío (ENT-9). | 29, 35, 44, 45, 72, 73, 74, 75, 77, 89, 90, 91, 92, 103, 104, 105, 106; 574, 575, 578, 611, 613, 617; HEAD (cuerpo vacío): 93, 614, 615 | confirmado |
| ERR-15 | **Orden 1-2**: ruteo (ruta+método → E404) antes que autenticación (E001). Un 404 gana contra un 401 con o sin token válido. | 69, 72, 73, 89, 90, 91, 92, 103, 104, 105, 106 | confirmado |
| RIE-8 | **`/health` exige token**: un balanceador o monitor sin credenciales recibe 401 y marca el servicio caído. Cierre: `/health` público o con credencial de infraestructura. | 1, 2, 95, 96 | confirmado |

## Notas sobre el reemplazo (`lib/service.ts`)

- `handle()` evalúa primero `ROUTES.has("<MÉTODO> <ruta>")` y después `auth === "Bearer " + TEAM_TOKEN`; si `TEAM_TOKEN` no está definido, todo da 401 (no está en la spec; comportamiento del reemplazo).
- El reemplazo añade `content-type: application/json; charset=utf-8`; los headers no se comparan en la evaluación y la spec no los documenta del original (supuesto).
