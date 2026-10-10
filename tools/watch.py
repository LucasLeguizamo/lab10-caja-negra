#!/usr/bin/env python3
"""Vigía de versión: el canario de los 20 ejemplos y una seq con los puntos que más discriminan.

  python3 tools/watch.py            una pasada; sale con 1 si algo cambió respecto al log

Cada request queda en experimentos.jsonl con su ts (vía probe.py). Lo esperado sale de las líneas
del log citadas; solo los ids OP se ajustan al estado propio de esta seq.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "experimentos.jsonl"


def rows():
    return {r["id"]: r for r in map(json.loads, LOG.read_text().splitlines()) if r}


def run_seq(name, hip, msgs):
    before = max(rows())
    subprocess.run([sys.executable, str(ROOT / "tools/probe.py"), "seq", name, hip, *msgs],
                   stdout=subprocess.DEVNULL, check=True)
    got = [r for i, r in sorted(rows().items()) if i > before and r["seq"] == name]
    return got[1:]  # sin el reset


def main():
    log = rows()
    big = log[429]["request"]["m"]  # cuerpo de 8508 caracteres que dio E101
    recieved = lambda op: {"status": "recieved", "operacionId": op}
    # (mensaje, status, cuerpo esperado, id del log que lo prueba)
    probes = [
        ("ALTA;Lucia;82", 201, {"cuentaId": "AC-0001"}, 3),
        ("ALTA;Mateo;3", 201, {"cuentaId": "AC-0002"}, 4),
        ("DEPOSITO;AC-0001;250000;86", 200, recieved("OP-0001"), 6),
        ("TRANSFER;AC-0001;AC-0002;100000;12", 200, recieved("OP-0002"), 302),
        ("TRANSFER;AC-0001;AC-0002;100001;9", 422, log[303]["response"], 303),
        ("DEPOSITO;AC-0001;9999999999;4", 200, recieved("OP-0003"), 204),
        ("DEPOSITO;AC-0001;10000000000;63", 400, log[209]["response"], 209),
        *[(log[i]["request"]["m"], log[i]["status"], log[i]["response"], i) for i in range(123, 129)],
        (" PING;64", 400, log[63]["response"], 63),
        ("CONSULT;AC-0001;41", 400, log[365]["response"], 365),
        (big, 413, log[429]["response"], 429),
    ]
    hhmm = time.strftime("%H%M")
    diffs = []
    got = run_seq(f"s-watch-{hhmm}", "Vigía horario: puntos discriminantes (ids 3-6, 63, 123-128, 204, 209, 302-303, 365, 429)",
                  [p[0] for p in probes])
    for (m, st, body, ref), r in zip(probes, got):
        if (r["status"], r["response"]) != (st, body):
            diffs.append(f"id {r['id']} (ref {ref}) m={m[:40]!r}: esperado {st} {body} · hoy {r['status']} {r['response']}")

    ex = [json.loads(l) for l in (ROOT / "material/pruebas/ejemplos.jsonl").read_text().splitlines()]
    got = run_seq(f"s-canario-{hhmm}", "Canario: los 20 ejemplos de la mañana (deriva de versión)",
                  [e["request"]["m"] for e in ex])
    for e, r in zip(ex, got):
        if (r["status"], r["response"]) != (e["status"], e["response"]):
            diffs.append(f"id {r['id']} (ejemplo {e['n']}): esperado {e['status']} {e['response']} · hoy {r['status']} {r['response']}")

    print(f"{time.strftime('%H:%M')} vigía: {len(probes) + len(ex)} pasos, {len(diffs)} diferencias")
    for d in diffs:
        print("  DIFF", d)
    sys.exit(1 if diffs else 0)


if __name__ == "__main__":
    main()
