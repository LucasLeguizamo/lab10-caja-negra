# Misión: agente que detecta y absorbe cambios del original

Agente [eve](https://eve.dev/docs) que vigila el servicio original cada hora. Cuando aparece un comando nuevo, o
cambia el comportamiento de uno existente, lanza una **misión**: entender cómo funciona, implementarlo en
`lib/service.ts` con su evidencia y sus pruebas, y abrir un PR en borrador. No despliega ni mergea: eso lo decide
una persona.

Vive aparte del reemplazo, con su propio `package.json`. El reemplazo no importa nada de aquí, `mision/` está
excluido del `tsconfig` y del `.vercelignore` de la raíz, y nada de esto llama al reemplazo (regla 2).

## Flujo

```
schedules/vigia.md (cron "15 * * * *", UTC)
  └─ coordinador (DeepSeek v4.1 Flash vía OpenRouter)
       1. vigia ──► watch.py (canario + puntos discriminantes) + sondeo_comandos.py (30 nombres, control correcto)
       │            ¿rama mision/* abierta? → no_reply      ¿sin cambios? → no_reply
       2. clasifica: comando nuevo | cambio de comportamiento | ruido (infra) — consulta la bitácora
       3. reclamar  ──► crea la rama mision/<slug>-<fecha> en GitHub (candado entre sesiones)
       4. explorador (mismo modelo) ──► sondear/concluir vía probe.py → spec/preguntas.md + spec/especificacion.md
       │                              informe Observado (ids) / Inferido / Desconocido
       5. tester (mismo modelo) ──► tests/<slug>.e2e.ts (tester-army/e2e): un test por regla observada, con ids
       │                         deben FALLAR antes de implementar → fijar_tests (commit; desde aquí tests/ no cambia)
       6. implementador (mismo modelo) ──► lib/service.ts → correr_e2e / verificar (hasta 3 intentos)
       7. publicar ──► verificar de nuevo → commit + push → PR en borrador ([SIN PARIDAD] si no pasa)
       8. bitácora ◄── una línea: fecha, slug, rama, PR, gasto
```

**Pruebas, en dos capas:**
- **Replay del log:** `tools/replay.py` reproduce **todo** `experimentos.jsonl` (viejo y las seqs `m-...` de la
  misión) contra un servidor de cero, con las reglas del evaluador. Prueba que no se rompió nada.
- **Suite e2e** (`tests/*.e2e.ts`, [tester-army/e2e](https://github.com/tester-army/e2e) 0.19.0): tests legibles por
  regla, con ids. Solo tests de API (`fetch` + matchers): sin navegador, sin agente, sin modelo, deterministas. La
  base (`contrato`, `ejemplos`) cubre el contrato del README y los 20 ejemplos; cada misión añade `tests/<slug>.e2e.ts`.
  El tester los escribe **antes** de implementar y comprueba que fallan; el implementador los hace pasar sin tocarlos.

Local: `E2E_BASE_URL=http://localhost:3111 pnpm e2e` en la raíz, con **Node ≥ 24.8** (`fnm exec --using=24 pnpm e2e`).

## Piezas

| Archivo | Rol |
|---|---|
| `agent/agent.ts`, `instructions.md` | Coordinador: topes por tokens y 6 h por sesión. Decide y delega; no tiene bash ni write_file. |
| `agent/lib/modelo.ts` | Modelo de los 3 agentes: `deepseek/deepseek-v4.1-flash` vía OpenRouter (`MISION_MODELO` lo cambia), ventana declarada y límites. |
| `agent/schedules/vigia.md` | Una sesión por hora (minuto 15 UTC). |
| `agent/tools/vigia.ts` | Corre `tools/watch.py` y `tools/sondeo_comandos.py`. Un crash (sin línea de resumen) es error, no "cambio". No sondea si hay una misión viva (ver Candado). |
| `agent/tools/reclamar.ts` | Candado: rama `mision/<slug>-<AAAAMMDD-HHMM>` con un commit vacío de reclamo. Si dos sesiones reclaman a la vez, el segundo push no es fast-forward y falla. |
| `agent/tools/publicar.ts` | Compuerta → commit de `lib spec tests experimentos.jsonl` (no `tools/`) → push → PR borrador vía API. |
| `agent/tools/verificar.ts` | Compuerta determinista (`lib/caja.ts`): regla 2 por grep; el log solo crece respecto a `origin/main`; `tests/` intactos desde el commit del tester (`.gate/tests.sha`); build limpio (`rm -rf .next`, con exit code real); servidor de cero en :3111; **`replay.py` de `origin/main`**, no el del sandbox; suite e2e completa sobre el mismo servidor. |
| `agent/subagents/explorador/` | Solo `sondear`, `concluir`, read/write/grep/glob. **Sin bash**: no puede hablar con el original fuera de probe.py. |
| `agent/subagents/tester/` | Especialista e2e. `correr_e2e`, `fijar_tests`, read/write/grep/glob. Sin bash ni acceso al original. Comparte el sandbox. |
| `agent/subagents/implementador/` | Bash + `correr_e2e` + `verificar`. Comparte el sandbox (`defineParentSandbox`). |
| `agent/memory/bitacora.ts` | Memoria entre sesiones (ver abajo). |
| `agent/sandbox.ts` | Vercel Sandbox: snapshot con el repo clonado + `pnpm install`; cada sesión hace `git reset --hard origin/main`. |
| `agent/lib/red.ts`, `lib/caja.ts` | Política de red y operaciones sobre el repo. Todos los tools pasan por aquí. |
| `../tools/sondeo_comandos.py` | Detector de comandos nuevos (nuevo en el repo; también sirve a mano). `--selftest` valida el control. |

## Candado entre sesiones

| Rama `mision/*` | Para el vigía |
|---|---|
| Reclamada hace < 2 h | Misión en curso: no sondea. |
| Reclamada hace ≥ 2 h y sin publicar | Huérfana (la sesión murió: timeout de 100 min < TTL de 2 h). Se ignora y se anota. |
| Publicada (punta `feat(mision)…`) | Bloquea hasta que una persona mergee o borre la rama. Si no, el vigía volvería a ver la misma diferencia y repetiría la misión. |

Horario (plan Hobby: un cron al día): `15 14 * * *` UTC = 09:15 hora local (UTC−5) arranca **una** sesión que hace una
pasada por hora, con `sleep` durable entre pasadas, hasta las 19:15 (`proximaPasadaS` en `lib/modelo.ts`). Nada
después de las 20:00. La sesión dura como máximo 11 h.

## Memoria: tres capas, cada cosa en su sitio

| Capa | Dónde | Qué guarda | Por qué ahí |
|---|---|---|---|
| **Evidencia** | `experimentos.jsonl`, `spec/` en git | Cada request, cada regla con sus ids | Es lo que se evalúa y se cita; git da historial y revisión. Nunca en memoria del modelo. |
| **Sesión** | `defineState("mision.gasto")` | Mensajes gastados por sesión (tope 400) | Muere con la sesión; un contador exacto no debe depender del modelo. |
| **Bitácora** | `fileMemory`, scope fijo `caja-negra`, Vercel Blob | Misiones (slug, rama, PR, resultado), falsos positivos y su causa, hipótesis caras descartadas | Cruza sesiones (cada hora es una sesión nueva) y evita repetir trabajo. Se recuerda entera en cada turno (≤ 6.000 caracteres). |

- **Scope fijo, no `byPrincipal`.** Las sesiones del cron corren como principal `app`, y `byPrincipal` desactiva
  la memoria para principales runtime. `namespace: "lab10-caja-negra"` hace que preview y producción compartan
  la bitácora.
- **Por qué `fileMemory` y no Supermemory/Upstash.** La bitácora es corta y se lee entera, así que no hace falta
  búsqueda semántica. Viene incluida en eve y no añade servicios ni claves. Se cambia si pasa de unas decenas
  de entradas.
- **La bitácora no se trata como instrucciones.** Las instrucciones lo dicen: son notas operativas. Lo que cuenta
  como verdad está en el log.

## Reglas del reto → mecanismo que las hace cumplir

| Regla (`CLAUDE.md`) | Mecanismo |
|---|---|
| 2. El reemplazo nunca llama al original | `verificar` rechaza `fetch(`, URLs, `railway.app` y `ORIGINAL_URL` en `lib app proxy.ts server.mjs`. |
| 3. Todo request al original pasa por probe.py | El firewall del sandbox **no deja salir** hacia el original salvo durante `sondear`/`vigia` (`conRed`). `web_fetch`/`web_search` desactivados en los 3 agentes (corren fuera del sandbox). El explorador no tiene bash. |
| 4. Un token = un explorador | `CAJA_TOKEN_AGENTE` propio. Dentro del agente solo explora el explorador, en secuencia. `probe.py` ya serializa las seqs con `.token.lock`. |
| 5. Toda afirmación cita ids | Instrucciones del explorador y formato del PR: observado / inferido / desconocido. |
| 6. Nunca commitear un token | Los tokens no entran al sandbox: el firewall inyecta `Authorization` en la frontera. `probe.py` ve el marcador `agente` y registra `auth: "team"`. `publicar` solo hace `git add` de `lib spec tools experimentos.jsonl`. |
| Nunca editar el log a mano | Solo `probe.py` escribe (`sondear`, `concluir`). `publicar` lo commitea tal cual. |

**Regla 1 ("nada de herramientas que hagan el trabajo por nosotros").** eve es el framework donde corre *nuestro*
agente. Las herramientas que tocan el original (`probe.py`, `watch.py`, `replay.py`, `sondeo_comandos.py`) siguen
siendo propias. Conviene confirmar con el reto que un agente propio sobre un framework es válido.

## Presupuesto (8.000 requests/día por token)

- **Vigía:** ~69 requests por pasada (canario de 20 y watch de ~16, cada uno con su reset, más 30 nombres) × 24
  ≈ 1.650 por día.
- **Misión:** tope de 400 mensajes por sesión del explorador (`defineState`). Con un reintento (dos sesiones) son
  ≤ 800 por misión.
- **Tokens del modelo:** DeepSeek v4.1 Flash en OpenRouter cuesta $0.30/M de entrada y $1.20/M de salida. Tope del
  root: 8M de entrada y 400k de salida (≈ $2.90 por sesión); los subagentes reciben una parte de lo que le queda al root.
  Con proveedor directo eve **no** recibe costo por paso, así que `maxTokenCostUsdPerSession` no contaría nada:
  por eso se limita por tokens. Pon además un tope de gasto en la key de OpenRouter, que sí es un límite real.

## Activar

1. `cd mision && pnpm install`. En `.env.local` o en el proyecto de Vercel, poner `CAJA_TOKEN_AGENTE` y
   `GITHUB_TOKEN` (ver `.env.example`).
2. `OPENROUTER_API_KEY` en el entorno. `pnpm exec eve link --project <proyecto>`: el sandbox y el Blob usan OIDC. **La cuenta o el equipo de
   Vercel lo decides tú** (el deploy sigue en pausa).
3. `pnpm exec eve add memory/file --non-interactive`: provisiona el Blob privado de la bitácora. El archivo
   `agent/memory/bitacora.ts` ya existe; si el registro quiere crear `memory/file.ts`, bórralo y deja `bitacora.ts`.
4. Probar en local sin esperar al cron: `pnpm exec eve dev --no-ui` y luego
   `curl -X POST localhost:2000/eve/v1/dev/schedules/vigia`.
5. `pnpm exec eve deploy`: el schedule se convierte en un Vercel Cron.

**Desplegado en el mismo proyecto que el reemplazo** (`lab10-caja-negra`, `vercel.json` con `services`):
`app` = reemplazo (raíz, todas las rutas) y `mision` = este agente, público solo en `/eve/*` (por ahí entra el cron;
`/eve/v1/session` rechaza sin credencial y el cron exige la cabecera de Vercel). `/eve` a secas sigue dando 404 E404.
Un build fallido no reemplaza producción: el último despliegue bueno sigue sirviendo.
- **Sin bindings:** el agente no llama al reemplazo desplegado. Su `localhost:3111` es el candidato que construye
  **dentro del sandbox** con el parche sin mergear; un binding probaría el código equivocado y le mandaría `/__reset`
  y cientos de requests al servicio que se evalúa.
- **Variables (Production):** `TEAM_TOKEN` (reemplazo); `OPENROUTER_API_KEY`, `CAJA_TOKEN` (o `CAJA_TOKEN_AGENTE`),
  `GITHUB_TOKEN` y `EVE_MEMORY_BLOB_*` (agente). Todas en el mismo proyecto.
- **Disparar el vigía a mano:** `vercel crons ls` para ver la ruta y `vercel crons run <ruta>`.
- **Ver qué hizo:** `vercel agent-runs list --project lab10-caja-negra` y `vercel agent-runs trace <runId> ...`.

## Límites conocidos (y cómo subirlos)

- **La paridad con todo el log es imposible si el original *cambia* algo existente.** Las filas viejas (canarios,
  ejemplos de la mañana) fijan el comportamiento anterior, así que viejo y nuevo se contradicen. Hoy la misión solo
  puede pasar la compuerta con **comandos nuevos** que no tocan filas viejas. Un cambio de comportamiento sale
  `[SIN PARIDAD]` y lo decide una persona. Arreglo: que `replay.py` acepte una lista de seqs superadas (p. ej.
  `--obsoletas s-watch-1100,...`) y que la misión declare cuáles reemplaza.
- **El sandbox clona `origin/main`:** el agente solo ve lo que está pusheado (`mision/`, `tools/sondeo_comandos.py`,
  el log al día). Antes de cada activación: `git push`. Un log local sin pushear choca en ids con la misión.

- **Colisión de ids.** `probe.py` numera con el número de líneas + 1 sobre su copia del log. Si una persona sondea
  en local mientras corre una misión, los dos logs reutilizan ids y el PR choca en `experimentos.jsonl`.
  Mitigación: por la tarde el agente es el único explorador. Mejora: un `tools/merge_log.py` que renumere las
  filas `m-...` y reescriba las citas en el diff del PR.
- **El log de las pasadas limpias del vigía se pierde.** El sandbox de cada sesión se descarta. Solo llegan al repo
  las filas de una pasada que lanza misión, porque `reclamar` las lleva a la rama. Mejora: empujarlas a una rama
  `log/vigia`.
- **Lista fija de nombres.** Un comando que no esté entre los 30 candidatos ni a distancia ≤ 2 de alguno no se ve.
  Mejora: que el coordinador proponga nombres nuevos según el dominio y los añada a `CANDIDATOS`.
- **Ventana de red compartida.** Mientras `sondear` tiene abierto el original, un bash del implementador también lo
  vería. En la práctica no pasa, porque las misiones son secuenciales (primero explora, después implementa).
  Mejora: un sandbox propio para el explorador.
- **Presupuesto por sesión, no por día.** El tope diario real lo pone el original (`X-Frontier-Infra: rate-limit`).
  `sondear` corta en cuanto aparece.
- **DeepSeek Flash en tareas largas.** Es un modelo rápido y barato. Explorar reglas byte a byte con muchas llamadas
  a herramientas es lo más exigente del flujo. Si los PRs salen `[SIN PARIDAD]` a menudo, sube solo el explorador y el
  implementador a un modelo más fuerte con `MISION_MODELO` o un `modelo()` propio en su `agent.ts`.
- **La ventana se declara a mano (200k).** eve no tiene metadata de modelos fuera del AI Gateway. El modelo admite
  1M; se declara menos para que compacte antes.
- **Tests fijados, pero en el sandbox.** `.gate/tests.sha` vive en el sandbox: un bash decidido del implementador
  podría reescribirlo. El PR muestra el diff de `tests/` de todos modos; revísalo antes de mergear.
- **Node ≥ 24.8 para e2e.** El `prepare` del sandbox instala el último 24 si la imagen trae uno anterior.
- **Clasificación del coordinador.** Si se equivoca, el costo es un PR en borrador que una persona cierra. La compuerta
  es determinista y no depende del modelo.

## Siguiente paso recomendado

Una eval (`eve eval`, ver `node_modules/eve/docs/evals/`) con tool stubs para el coordinador: tres salidas del
vigía (limpia, comando nuevo, rate-limit) y su acción esperada (`no_reply`, `reclamar`+delegar, `no_reply`+bitácora).
Fija la clasificación antes de darle el cron.
