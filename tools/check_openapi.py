#!/usr/bin/env python3
"""¿openapi.yaml y docs/api/*.md siguen al día con el código? Falla si el reemplazo tiene algo que la doc no cuenta.

  python3 tools/check_openapi.py            sale con 1 y lista lo que falta
  python3 tools/check_openapi.py --selftest

Fuente de verdad: lib/service.ts (ROUTES y cada código "Exxx" que puede devolver). Sin dependencias: lee el YAML como
texto (solo busca claves de ruta, métodos y códigos).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def rutas(service: str) -> list[tuple[str, str]]:
    m = re.search(r"const ROUTES = new Set\(\[(.*?)\]\)", service, re.S)
    return [tuple(r.split(" ", 1)) for r in re.findall(r'"([A-Z]+ /[^"]*)"', m.group(1))] if m else []


def faltantes(service: str, openapi: str, docs: set[str]) -> list[str]:
    out = []
    for metodo, ruta in rutas(service):
        bloque = re.search(rf"^  {re.escape(ruta)}:\n((?:    .*\n|\n)*)", openapi, re.M)
        if not bloque:
            out.append(f"openapi.yaml: falta la ruta {ruta}")
        elif not re.search(rf"^    {metodo.lower()}:", bloque.group(1), re.M):
            out.append(f"openapi.yaml: falta {metodo} en {ruta}")
        if f"{ruta.strip('/')}.md" not in docs:
            out.append(f"docs/api/{ruta.strip('/')}.md: no existe")
    for codigo in sorted(set(re.findall(r'"(E\d{3})"', service))):
        if codigo not in openapi:
            out.append(f"openapi.yaml: no documenta {codigo}")
    return out


def selftest():
    svc = 'const ROUTES = new Set(["GET /health", "POST /msg"]);\nerr(400, "E301", "x");'
    oa = "paths:\n  /health:\n    get:\n      x: 1\n  /msg:\n    post:\n      x: E301\n"
    assert faltantes(svc, oa, {"health.md", "msg.md"}) == []
    assert faltantes(svc, oa.replace("    post:", "    get:"), {"health.md", "msg.md"}) == ["openapi.yaml: falta POST en /msg"]
    assert faltantes(svc, oa.replace("E301", "E999"), {"health.md", "msg.md"}) == ["openapi.yaml: no documenta E301"]
    assert faltantes(svc, oa, {"health.md"}) == ["docs/api/msg.md: no existe"]


def main():
    selftest()
    if "--selftest" in sys.argv:
        return print("selftest ok")
    oa = ROOT / "openapi.yaml"
    docs = {p.name for p in (ROOT / "docs/api").glob("*.md")} if (ROOT / "docs/api").is_dir() else set()
    falta = faltantes((ROOT / "lib/service.ts").read_text(), oa.read_text() if oa.exists() else "", docs)
    for f in falta:
        print("FALTA", f)
    print(f"openapi al día: {'no' if falta else 'sí'} ({len(rutas((ROOT / 'lib/service.ts').read_text()))} rutas)")
    sys.exit(1 if falta else 0)


if __name__ == "__main__":
    main()
