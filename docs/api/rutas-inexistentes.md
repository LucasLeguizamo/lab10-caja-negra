# Rutas inexistentes (404 E404)

> Documentación del repositorio. **El reemplazo no sirve este archivo.** Esta página describe el comportamiento "catch-all", no un endpoint.
> Fuente: `spec/especificacion.md` (log ids 1-731), `lib/service.ts`, `proxy.ts`. Definición OpenAPI: extensión `x-rutas-desconocidas` en [`openapi.yaml`](../../openapi.yaml).

## Qué cubre

Toda combinación ruta+método que no sea `GET /health`, `POST /__reset` o `POST /msg` (incluida la raíz `/`).

## Respuesta

| Status | Cuerpo exacto | Notas |
|---|---|---|
| 404 | `{"error":"E404","mensaje":"ruta desconocida"}` | Con o sin token, con token válido o inválido, para cualquier método (salvo HEAD). Sin header `X-Req` y no cuenta para `X-Req`. |
| 404 (`HEAD`) | `` (cuerpo vacío) | `HEAD /msg` (con y sin token) y `HEAD /health` (con token). |

## Orden de evaluación

El ruteo es **lo primero**: se evalúa antes que la autenticación. Una ruta inexistente sin token da 404 E404, no 401. Con un cuerpo de
~8300 bytes sigue siendo 404 (no 413): POST `/nada` con y sin token, POST `/health` (ERR-15, ERR-29).

## Casos observados

| Caso | Resultado | ids |
|---|---|---|
| `GET /nada` con token / sin token | 404 E404 | 29, 72, 103 |
| `POST /nada` con y sin token | 404 E404 | 73, 104 |
| `GET /` | 404 E404 | 74 |
| `GET /msg` | 404 E404 | 35 |
| `POST /health` | 404 E404 | 44, 69 |
| `GET /__reset` | 404 E404 | 45 |
| `PUT /msg`, `DELETE /msg`, `PATCH /msg`, `OPTIONS /msg` | 404 E404 | 89, 106 (PUT); 90; 91; 92 |
| Mayúsculas: `GET /HEALTH` sin token / token inválido | 404 E404 | 77, 105 |
| Mayúsculas: `POST /MSG` con token válido | 404 E404, sin `X-Req` | 613 |
| Barra final: `GET /health/` sin token / con token | 404 E404 | 75, 617 |
| Barra final: `POST /msg/` con token válido | 404 E404, sin `X-Req` | 611 |
| `HEAD /msg` sin token / con token; `HEAD /health` con token | 404, cuerpo vacío | 93, 615; 614 |
| Con cuerpo de ~8300 bytes | 404 (no 413) | 574, 575, 578 |

## NO observado (supuestos del reemplazo)

- **`//` (doble barra)**: **NO observado en el log.** `proxy.ts` responde 404 E404 sin auth por diseño (Next.js redirigiría con 308); es un supuesto, no una copia del original.
- `\` en la ruta y `/_next/*`: tampoco observados; `proxy.ts` los trata como 404 E404 (el comentario de `proxy.ts` cita ids 29, 35, 44, 45, que prueban 404 genérico, no estos casos).
- `HEAD` sobre `/__reset`, sobre rutas inexistentes o con token inválido; `OPTIONS`/`PUT`/`DELETE` sobre `/health` y `/__reset` con token (la spec los lista como desconocido; el reemplazo da 404 E404 por defecto).
- `GET /HEALTH` con token válido (solo se probó sin token y con token inválido).
- Rutas con `%`-escapes, mayúsculas en `/__RESET`, etc.: no probadas.

## Estado / memoria

No lee ni escribe estado; no consume `X-Req`.

## Ejemplos curl

```bash
BASE=https://lab10-caja-negra.vercel.app

# 404 {"error":"E404","mensaje":"ruta desconocida"}  (sin token: ruteo antes que auth)
curl -i "$BASE/nada"

# 404 con token válido
curl -i -H "Authorization: Bearer $TOKEN" "$BASE/nada"

# 404 (mayúsculas)
curl -i "$BASE/HEALTH"

# 404 (método no soportado)
curl -i -X PUT -H "Authorization: Bearer $TOKEN" "$BASE/msg"

# 404 con cuerpo vacío (HEAD)
curl -i -I -H "Authorization: Bearer $TOKEN" "$BASE/msg"

# '//' : NO observado en el original (el reemplazo responde 404 E404, supuesto)
curl -i --path-as-is "$BASE//health"
```

## Filas de la spec

| ID | Comportamiento | Evidencia | Confianza |
|---|---|---|---|
| ENT-1 | Las únicas combinaciones ruta+método con comportamiento propio son `GET /health`, `POST /__reset` y `POST /msg`. Todo lo demás cae en ENT-6. | 2, 3, 4 (las tres válidas); 35, 44, 45, 89, 90, 91, 92 (otros métodos sobre ellas = 404); 93, 614, 615 (HEAD = 404, ENT-9) | confirmado |
| ENT-6 | Ruta o método no soportado (incluida la raíz `/`) responde **404** `{"error":"E404","mensaje":"ruta desconocida"}`, con o sin token, con token válido o inválido, para cualquier método. No lleva `X-Req` y no cuenta. Excepción de formato: `HEAD` también da 404 pero con cuerpo vacío (ENT-9). Con cuerpo de ≈8300 bytes sigue siendo 404 (no 413): POST /nada con y sin token, POST /health. | GET /nada: 29, 72, 103; POST /nada: 73, 104; GET /: 74; GET /msg: 35; POST /health: 44, 69; GET /__reset: 45; PUT /msg: 89, 106; DELETE /msg: 90; PATCH /msg: 91; OPTIONS /msg: 92 (x_req null en 29, 35, 44, 45); con cuerpo grande: 574, 575, 578 (x_req null) | confirmado |
| ENT-7 | El ruteo distingue mayúsculas: `GET /HEALTH` es 404 E404 (no es `/health`), sin token (77) y con token **inválido** (105); `POST /MSG` con token válido también es 404 E404 y no cuenta `X-Req` (613). (No se probó `GET /HEALTH` con token válido.) | 77, 105, 613 | confirmado |
| ENT-8 | El ruteo no normaliza la barra final: `GET /health/` es 404 E404 sin token (75) y con token válido (617); `POST /msg/` con token válido también (611, sin `X-Req`). | 75, 617, 611 | confirmado |
| ENT-9 | `HEAD` no está soportado: `HEAD /msg` sin token (93), `HEAD /msg` con token válido (615) y `HEAD /health` con token válido (614) dan status **404** con cuerpo vacío (`""`), sin `X-Req`. No se probó `HEAD` sobre `/__reset`, sobre rutas inexistentes ni con token inválido. | 93, 615 (`/msg`); 614 (`/health`) | confirmado (`HEAD /msg`) / probable (`HEAD /health`) |
| ERR-2 | **E404** · 404 · `{"error":"E404","mensaje":"ruta desconocida"}` — ruta o método no soportados (ENT-6). Con `HEAD` el status es el mismo pero el cuerpo es vacío (ENT-9). | 29, 35, 44, 45, 72, 73, 74, 75, 77, 89, 90, 91, 92, 103, 104, 105, 106; 574, 575, 578, 611, 613, 617; HEAD (cuerpo vacío): 93, 614, 615 | confirmado |
| ERR-15 | **Orden 1-2**: ruteo (ruta+método → E404) antes que autenticación (E001). Un 404 gana contra un 401 con o sin token válido. | 69, 72, 73, 89, 90, 91, 92, 103, 104, 105, 106 | confirmado |
| MEM-3 | No cuentan ni llevan `X-Req`: `GET /health`, `POST /__reset`, las respuestas 404 y los 401. | 24, 27, 29, 35, 37, 38, 44, 45; 39 (X-Req=30 tras dos 401); 46 (35 tras 404s y health); 567-569 (401), 574-578 (404 y 200 con cuerpo grande), 611, 613 (404), 614, 615 (HEAD), 616-618 (health/reset con query): x_req null | confirmado |
| RIE-9 | **404 genérico para método incorrecto** (GET /msg, POST /health, PUT /msg…): no hay 405 ni `Allow`; el cliente no sabe si la ruta existe. Además `HEAD` responde 404 con cuerpo vacío, también sobre `/health` y `/msg` con token válido: un monitor que use `HEAD /health` ve 404 y cree que el servicio no existe. Cierre: 405 + `Allow`, y `HEAD` igual que `GET` sin cuerpo. | 35, 44, 45, 89-92, 93, 614, 615 | confirmado |

## Notas sobre el reemplazo

- `lib/service.ts`: `ROUTES = {"GET /health","POST /__reset","POST /msg"}`; fuera de ese set, `E404()` antes de mirar el token.
- `app/[[...path]]/route.ts` exporta GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS hacia `handle()`; para `HEAD` envía cuerpo `null`.
- `proxy.ts` intercepta `//`, `\` y `/_next/*` con el mismo 404 E404 (supuesto, ver arriba).
- Estos archivos (`openapi.yaml`, `docs/api/*`) no se sirven: `GET /openapi.yaml` o `GET /docs/api/health.md` dan 404 E404.
