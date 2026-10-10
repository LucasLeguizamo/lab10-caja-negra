#!/usr/bin/env python3
"""Reconstruye una corrida del set oculto desde la caja de vuelo del reemplazo y la diffea contra el original.

  corrida.py bajar --desde 15:05 [--hasta 15:20] [--ua evaluador]   Redis -> corridas/<desde>.jsonl (un test por línea)
  corrida.py diff corridas/<desde>.jsonl [--solo N,M]               cada test contra el original (vía probe: queda en
                                                                     experimentos.jsonl como seq oculto-<desde>-<n>)

El set no muestra sus casos, pero se los manda a nuestro reemplazo: lib/service.ts graba cada request (record()).
Un test = un POST /__reset y lo que siga hasta el próximo. corridas/ está en .gitignore: el repo es público.
Necesita KV_REST_API_URL/KV_REST_API_TOKEN (vercel env pull) y, para diff, CAJA_TOKEN.
Después del diff, tools/replay.py ya cubre estos tests como regresión: están en el log.
"""
import argparse
import collections
import json
import os
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import probe  # noqa: E402
from replay import same_body  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "corridas"
KEY = f"caja:{os.environ.get('VERCEL_ENV_GRABADO', 'production')}:vuelo"


def ms(hhmm, day):
    return int(datetime.strptime(f"{day} {hhmm}", "%Y-%m-%d %H:%M").timestamp() * 1000)


def tests_de(rows):
    tests = []
    for r in rows:
        if (r["method"], r["path"]) == ("POST", "/__reset"):
            tests.append({"reset": r, "pasos": []})
        elif tests:
            tests[-1]["pasos"].append(r)
    return tests  # ponytail: lo previo al primer reset se descarta (tráfico ajeno al set)


def bajar(a):
    url, tok = os.environ["KV_REST_API_URL"], os.environ["KV_REST_API_TOKEN"]
    req = urllib.request.Request(f"{url}/lrange/{KEY}/0/-1", headers={"Authorization": f"Bearer {tok}"})
    rows = [json.loads(x) for x in json.load(urllib.request.urlopen(req))["result"]][::-1]  # lpush -> cronológico
    day = a.dia or time.strftime("%Y-%m-%d")
    lo, hi = ms(a.desde, day), ms(a.hasta, day) if a.hasta else 1 << 62
    rows = [r for r in rows if lo <= r["ts"] < hi]
    print("user-agents:", dict(collections.Counter(r.get("ua") for r in rows)))
    if a.ua:
        rows = [r for r in rows if a.ua in (r.get("ua") or "")]
    tests = tests_de(rows)
    largos = collections.Counter("1" if len(t["pasos"]) == 1 else "2-5" if len(t["pasos"]) <= 5 else "6-12"
                                 for t in tests)
    print(f"{len(tests)} tests (esperado 100: 40 de 1, 45 de 2-5, 15 de 6-12) -> {dict(largos)}")
    OUT.mkdir(exist_ok=True)
    f = OUT / f"{day}_{a.desde.replace(':', '')}.jsonl"
    f.write_text("".join(json.dumps({"n": i + 1, **t}, ensure_ascii=False) + "\n" for i, t in enumerate(tests)))
    print(f"-> {f}")


def texto(resp):
    return resp if isinstance(resp, str) else json.dumps(resp, ensure_ascii=False)


def diff(a):
    probe.load_env()
    token = os.environ["CAJA_TOKEN"]
    tests = [json.loads(l) for l in Path(a.archivo).read_text().splitlines() if l.strip()]
    if a.solo:
        tests = [t for t in tests if t["n"] in {int(x) for x in a.solo.split(",") if x}]
    tag = Path(a.archivo).stem
    causa = collections.Counter()
    for t in tests:
        seq = f"oculto-{tag}-{t['n']}"
        probe.call(seq, f"test {t['n']} del set oculto ({tag}): reset", "POST", "/__reset", None, token)
        fallo = None
        for k, p in enumerate(t["pasos"], 1):
            auth = p["auth"]
            kw = {"auth_raw": auth.replace("<otro>", "token-invalido")} if auth not in ("team", None) else {}
            o = probe.call(seq, f"test {t['n']} paso {k}/{len(t['pasos'])}", p["method"], p["path"],
                           p["body"] if p["body"] != "" or p["method"] != "GET" else None,
                           token if auth == "team" else None, content_type=p.get("ct"), **kw)
            if fallo is None and (o["status"] != p["status"] or not same_body(o["response"], texto(p["response"]))):
                fallo = (k, "status" if o["status"] != p["status"] else "cuerpo", o, p)
        if fallo:
            k, tipo, o, p = fallo
            causa[tipo] += 1
            causa["primer request" if k == 1 else "más adelante"] += 1
            print(f"FALLA test {t['n']} paso {k} ({tipo}): {p['method']} {p['path']} {p['body']!r}\n"
                  f"   original  {o['status']} {texto(o['response'])}\n   nosotros  {p['status']} {texto(p['response'])}")
    print(f"\n{len(tests) - causa['status'] - causa['cuerpo']}/{len(tests)} pasan | {dict(causa)}")


def main():
    probe.load_env()
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="cmd", required=True)
    b = s.add_parser("bajar"); b.add_argument("--desde", required=True); b.add_argument("--hasta")
    b.add_argument("--dia"); b.add_argument("--ua")
    d = s.add_parser("diff"); d.add_argument("archivo"); d.add_argument("--solo")
    a = ap.parse_args()
    bajar(a) if a.cmd == "bajar" else diff(a)


if __name__ == "__main__":
    assert [len(t["pasos"]) for t in tests_de([{"method": "GET", "path": "/x"}, {"method": "POST", "path": "/__reset"},
            {"method": "POST", "path": "/msg"}, {"method": "POST", "path": "/__reset"}])] == [1, 0]
    main()
