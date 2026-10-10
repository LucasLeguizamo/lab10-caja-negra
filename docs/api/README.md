# Documentación de la API del reemplazo

Documentación de la caja negra tal como la reproduce el reemplazo (`lib/service.ts`), derivada de `spec/especificacion.md`
(evidencia: `experimentos.jsonl`, ids 1-731, hasta 2026-10-10T13:00:14-0500).

> **Regla: estos archivos no se sirven desde el reemplazo.** `openapi.yaml` y `docs/api/*` son solo documentación del repositorio.
> El contrato del reto exige que cualquier ruta que no exista en el original responda `404` `{"error":"E404","mensaje":"ruta desconocida"}`
> (incluidas `/openapi.yaml`, `/docs`, `/docs/api/*`). No los copies a `public/`, no añadas rutas ni rewrites para exponerlos.

## Índice

| Archivo | Qué documenta |
|---|---|
| [`../../openapi.yaml`](../../openapi.yaml) | Especificación OpenAPI 3.1.0 de `GET /health`, `POST /__reset` y `POST /msg`, con esquemas, ejemplos, `x-spec-ids`, `x-log-ids`, `x-commands` y `x-error-precedence`. |
| [`health.md`](health.md) | `GET /health` |
| [`__reset.md`](__reset.md) | `POST /__reset` |
| [`msg.md`](msg.md) | `POST /msg`: formato, control, respuestas, orden de errores, una sección por comando (PING, ALTA, CONSULTA, DEPOSITO, TRANSFER, ANULA), memoria, errores, riesgos y cambios del día |
| [`rutas-inexistentes.md`](rutas-inexistentes.md) | Todo lo demás: `404 E404` (métodos, mayúsculas, barra final, `HEAD`, `//` no observado) |

## Resumen del contrato

- Auth: `Authorization: Bearer <token>` en las tres rutas (incluido `/health`). Si falla -> `401` `{"error":"E001","mensaje":"no autorizado"}`.
- Ruteo antes que auth: ruta o método no soportado -> `404` `{"error":"E404","mensaje":"ruta desconocida"}` aunque no haya token.
- Estado por token en memoria; `POST /__reset` lo vacía pero no reinicia `X-Req`.
- Cada fila de las tablas cita ids de `experimentos.jsonl`; confianza: confirmado / probable / supuesto (misma convención que la spec).

## Mantenimiento

Fuente de verdad: `spec/especificacion.md`. Si la spec cambia, actualizar estos archivos copiando las filas afectadas.
Estos documentos no son evidencia: no citarlos como tal en la spec.
