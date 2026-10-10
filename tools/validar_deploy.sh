#!/usr/bin/env bash
# Valida un reemplazo DESPLEGADO como lo haría el evaluador: replay de todo el log + suite e2e.
#   tools/validar_deploy.sh https://mi-reemplazo.up.railway.app
# Usa TEAM_TOKEN del .env (el token que acepta el despliegue); nunca lo imprime. Nunca habla con el original.
# Con estado en memoria, varias instancias darían AC/OP o E401 inesperados: correrlo 2-3 veces con pausas lo destapa.
set -uo pipefail
URL="${1:?uso: tools/validar_deploy.sh <URL del reemplazo>}"
cd "$(dirname "$0")/.."
TEAM_TOKEN="${TEAM_TOKEN:-$(grep -E '^TEAM_TOKEN=' .env 2>/dev/null | cut -d= -f2-)}"
[ -n "$TEAM_TOKEN" ] || { echo "falta TEAM_TOKEN (en .env o en el entorno)" >&2; exit 2; }
case "$URL" in *railway.app*caja-negra-production*|*caja-negra-production-c64f*) echo "esa es la URL del ORIGINAL" >&2; exit 2;; esac

echo "== health"; curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TEAM_TOKEN" "$URL/health"
echo "== replay"; REPLAY_TOKEN="$TEAM_TOKEN" python3 tools/replay.py "$URL" | tail -3; rp=${PIPESTATUS[0]}
echo "== e2e (Node >= 24.8)"
E2E_TELEMETRY_DISABLED=1 E2E_BASE_URL="$URL" E2E_TOKEN="$TEAM_TOKEN" pnpm -s e2e | tail -6; ee=${PIPESTATUS[0]}
echo "replay=$rp e2e=$ee"
[ "$rp" -eq 0 ] && [ "$ee" -eq 0 ]
