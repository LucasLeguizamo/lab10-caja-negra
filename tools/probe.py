#!/usr/bin/env python3
"""Única puerta al original. Cada request queda en experimentos.jsonl (formato de material/README.md).

  probe.py seq <seq> <hipotesis> <m> [<m> ...]          POST /__reset y luego cada m por POST /msg
  probe.py raw <seq> <hipotesis> <METHOD> <path> [body]  request arbitrario (body crudo, sin reset)
        [--no-auth | --token X]                          probar autenticación

Token: CAJA_TOKEN en .env (uno por explorador: cada token tiene su propio estado).
"""
import argparse
import fcntl
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "experimentos.jsonl"


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def send(method, path, body, token):
    base = os.environ.get("ORIGINAL_URL", "https://caja-negra-production-c64f.up.railway.app")
    headers = {"Content-Type": "application/json"}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    data = body.encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method, headers=headers)
    t = time.monotonic()
    try:
        r = urllib.request.urlopen(req, timeout=10)
        status, raw, h = r.status, r.read(), r.headers
    except urllib.error.HTTPError as e:
        status, raw, h = e.code, e.read(), e.headers
    ms = int((time.monotonic() - t) * 1000)
    time.sleep(0.12)  # ponytail: tope fijo de 10 req/s por token; no hay paralelismo por token
    text = raw.decode("utf-8", "replace")
    try:
        resp = json.loads(text)
    except ValueError:
        resp = text  # no JSON: se guarda el texto exacto, el set lo compara carácter por carácter
    return status, resp, h, ms


def log(entry):
    with open(LOG, "a+", encoding="utf-8") as f:
        fcntl.flock(f, fcntl.LOCK_EX)  # varios agentes escriben a la vez: ids únicos
        f.seek(0)
        entry = {"id": sum(1 for line in f if line.strip()) + 1, **entry}
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(json.dumps(entry, ensure_ascii=False))
    return entry


def call(seq, hip, method, path, body, token):
    status, resp, h, ms = send(method, path, body, token)
    try:
        request = json.loads(body) if body is not None else None
    except ValueError:
        request = body
    entry = {"seq": seq, "x_req": h.get("X-Req"), "hipotesis": hip, "request": request,
             "status": status, "response": resp, "ms": ms}
    if (method, path) != ("POST", "/msg"):
        entry["method"], entry["path"] = method, path
    if h.get("X-Frontier-Infra"):
        entry["infra"] = h["X-Frontier-Infra"]  # respuesta de la infraestructura, no del servicio
        print(f"!! infra: {entry['infra']} — baja el ritmo", file=sys.stderr)
    return log(entry)


def main():
    load_env()
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("seq")
    s.add_argument("seq"); s.add_argument("hipotesis"); s.add_argument("m", nargs="+")
    r = sub.add_parser("raw")
    r.add_argument("seq"); r.add_argument("hipotesis"); r.add_argument("method"); r.add_argument("path")
    r.add_argument("body", nargs="?")
    r.add_argument("--no-auth", action="store_true"); r.add_argument("--token")
    a = p.parse_args()

    token = os.environ.get("CAJA_TOKEN")
    if a.cmd == "seq":
        if not token:
            sys.exit("falta CAJA_TOKEN en .env")
        call(a.seq, a.hipotesis, "POST", "/__reset", None, token)
        for m in a.m:
            call(a.seq, a.hipotesis, "POST", "/msg", json.dumps({"m": m}, ensure_ascii=False), token)
    else:
        tok = None if a.no_auth else (a.token or token)
        call(a.seq, a.hipotesis, a.method.upper(), a.path, a.body, tok)


if __name__ == "__main__":
    main()
