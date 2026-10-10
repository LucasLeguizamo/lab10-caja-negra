# Lab 10 — La caja negra (Frontier, reto 2)

Servicio HTTP de 10 años sin docs. Hay que entenderlo y construir un reemplazo que
responda **exactamente igual, errores incluidos**. Fuente de verdad del reto:
`material/README.md` — léelo completo antes de cualquier trabajo.

## Lo esencial del material

- Original: `https://caja-negra-production-c64f.up.railway.app`
- `POST /msg` con `{"m": "CMD;arg;...;control"}`, `POST /__reset`, `GET /health`.
- `Authorization: Bearer <token>`; **cada token tiene su propio estado**.
- Límite por token: 10 req/s y **8.000 req/día**. Header `X-Frontier-Infra: rate-limit` = infra, no servicio.
- **El servicio cambia durante el día.** Cuenta la versión vigente a las 20:00.
  `material/pruebas/ejemplos.jsonl` es de la versión de la mañana.
- Evaluación: 100 tests (status + cuerpo; JSON sin orden de claves; texto exacto si no es JSON),
  cada uno tras `/__reset`, 5 s por paso, contra **un solo proceso**.

## Reglas duras

1. **Nada de herramientas que hagan el trabajo por nosotros.** Solo scripts y fuzzers propios.
2. **El reemplazo nunca llama al original ni a otro reemplazo.** Si lo hace, el set vale 0.
3. **Todo request al original pasa por `tools/probe.py`**, que lo escribe en `experimentos.jsonl`.
   Nada de `curl` suelto: un request sin registrar es evidencia perdida.
4. **Un token = un explorador a la vez.** Dos agentes con el mismo token se pisan el estado.
   Para explorar en paralelo, cada agente recibe un token distinto (`CAJA_TOKEN` por agente).
5. **Toda afirmación de la spec cita `id`s del log.** Una afirmación falsa resta puntos.
6. Los tokens van en `.env` (ignorado por git). **El repo es público: nunca commitear un token.**

## Entregables

| Entregable | Dónde | Dueño |
|---|---|---|
| Reemplazo desplegado (contrato en material/README) | `lib/service.ts` (Next.js, ruta única `app/[[...path]]/route.ts`) + URL en `README.md` | implementer |
| Especificación (7 secciones, tablas `ID \| Comportamiento \| Evidencia \| Confianza`) | `spec/especificacion.md` | spec-writer |
| Log de experimentos | `experimentos.jsonl` (lo escribe `tools/probe.py`) | todos vía probe |

## Flujo

```
recon-prober ─┐                                   ┌─► implementer ─► lib/service.ts
fuzzer ───────┼─► experimentos.jsonl ─► spec-writer ─► spec/          │
              │          ▲            system-designer (modelo + diseño)│
              └──────────┴──── huecos ◄── parity-verifier ◄───────────┘
```

## Uso de probe

```bash
python3 tools/probe.py seq s1 "PING ignora el control" "PING;00" "PING;XX"
python3 tools/probe.py raw s2 "ruta inexistente sin token" GET /nada --no-auth
```

`seq` hace `/__reset` primero (también queda registrado). Usa nombres de `seq` únicos y descriptivos.
Token por agente: `CAJA_TOKEN=<token> python3 tools/probe.py ...`.
Conclusiones: `python3 tools/probe.py concluir <id> "<texto>"`. **Nunca editar `experimentos.jsonl` a mano.**
Paridad: `python3 tools/replay.py http://localhost:3000` (de parity-verifier).

## Skills del repo

Instaladas con `pnpm dlx skills add` / `pnpm dlx autoskills` (lock: `skills-lock.json`).
Relevantes: `next-best-practices`, `nodejs-backend-patterns`, `typescript-advanced-types`, `gdp-ts`.

## Stack del reemplazo

- Next.js 16 con **pnpm** (nunca npm/yarn). Docs de esta versión: `node_modules/next/dist/docs/`.
- Una sola ruta `app/[[...path]]/route.ts` (todos los métodos) → `handle()` en `lib/service.ts`.
  Así Next no decide nada por su cuenta (`skipTrailingSlashRedirect`, sin 404 propio).
- Estado en memoria ⇒ **un solo proceso de larga vida**: `pnpm build && pnpm start` en Railway/Render
  con 1 réplica. Vercel serverless puede repartir en varias instancias con estado distinto: evitar.
- Token del equipo en `TEAM_TOKEN` (env), nunca en código.
