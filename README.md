# Lab 10 — La caja negra

Ingeniería inversa de un servicio HTTP sin documentación y reemplazo con comportamiento idéntico,
errores incluidos. Enunciado completo: [`material/README.md`](material/README.md).

| Entregable | Dónde |
|---|---|
| Reemplazo desplegado | _pendiente_ — código en [`lib/service.ts`](lib/service.ts) |
| Especificación | [`spec/especificacion.md`](spec/) |
| Log de experimentos | [`experimentos.jsonl`](experimentos.jsonl) |

## Explorar

```bash
cp .env.example .env   # pon tu token en CAJA_TOKEN
python3 tools/probe.py seq s1 "PING ignora el control" "PING;00"
```

Todo request al original pasa por `tools/probe.py` y queda en `experimentos.jsonl`.
Los subagentes del equipo viven en `.claude/agents/`.

## Desplegar el reemplazo

El estado vive en memoria: tiene que ser **un solo proceso de larga vida, 1 réplica, sin autoescalado**. Si el
evaluador cae en dos instancias con estados distintos, los AC/OP cambian y aparecen E401.

| | Railway (recomendado) | Render | Vercel (ya configurado) |
|---|---|---|---|
| Proceso | uno, persistente | uno, persistente | serverless: puede repartir en varias instancias (riesgo A1) |
| Build | `pnpm install --frozen-lockfile && pnpm build` | igual | automático (`vercel.json`, `proxy.ts`) |
| Start | `pnpm start` (= `node server.mjs`, lee `PORT`) | igual | — |
| Réplicas | 1 (Settings → Deploy) | 1 instancia, plan sin *spin down* (el free se duerme y el primer request pasa de 5 s) | — |
| Node | 24 (`engines` en `package.json`) | igual | igual |

Variables de entorno (solo una): **`TEAM_TOKEN`** = token del equipo de la tarjeta del reto en `/evento`.
Sin ella todo responde 401. Nunca va en el código ni en el repo.

Pasos (Railway, desde el dashboard, sin Docker): *New Project → Deploy from GitHub repo* →
`LucasLeguizamo/lab10-caja-negra` → *Variables*: `TEAM_TOKEN` → *Settings*: build y start de la tabla, 1 réplica →
*Networking → Generate Domain*. En Render: *New Web Service* con los mismos comandos e *Instances: 1*.

Vercel (si se elige pese a A1): `vercel link` (equipo a elegir) → `vercel env add TEAM_TOKEN production` →
`vercel deploy --prod`. Desactivar *Deployment Protection* en producción, o el evaluador recibe la página de login.

### Validar antes de entregar

```bash
tools/validar_deploy.sh https://<url-del-reemplazo>   # replay del log + suite e2e, con TEAM_TOKEN del .env
```

Debe dar `replay=0 e2e=0`. Correrlo 2 o 3 veces con unos minutos de pausa: si falla de forma intermitente, hay
más de una instancia. Después, poner la URL de producción (no la de un preview) arriba en esta tabla y en `/evento`.

## Desplegar el agente

Proyecto de Vercel **aparte**, desde `mision/`. Pasos y credenciales en [`mision/README.md`](mision/README.md#activar).
