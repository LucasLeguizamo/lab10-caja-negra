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
