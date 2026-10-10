#!/usr/bin/env python3
"""Detector de comandos nuevos: manda nombres candidatos con control correcto y compara contra el modelo actual.

  python3 tools/sondeo_comandos.py            una seq vía probe.py; sale con 1 si hay candidatos nuevos, 2 si se cayó
  python3 tools/sondeo_comandos.py --selftest solo el self-check del control y de la sugerencia

Señal (Q9a/Q9c, ids 79-82, 452-471): con control correcto, un nombre desconocido da 400 E301 y, si está a
Levenshtein <= 2 de un comando conocido, `sugerencia`. Cualquier otra cosa delata un comando nuevo:
  - status/error distinto de E301 (p.ej. E302 aridad: el nombre existe), o
  - `sugerencia` distinta de la que da nuestro conjunto (el original sugiere desde SU conjunto).
Imprime una línea JSON por hallazgo: {"id", "m", "esperado", "hoy"}.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "experimentos.jsonl"

CONOCIDOS = ["ALTA", "ANULA", "CONSULTA", "DEPOSITO", "PING", "TRANSFER"]  # lib/service.ts ARIDAD
# ponytail: lista fija de nombres bancarios plausibles; un nombre que no esté aquí ni a d<=2 de alguno no se ve.
CANDIDATOS = [
    "SALDO", "RETIRO", "RETIRA", "EXTRACTO", "HISTORIAL", "MOVIMIENTOS", "LISTA", "LISTAR", "BAJA", "CIERRE",
    "CERRAR", "BLOQUEO", "BLOQUEA", "DESBLOQUEA", "PAGO", "PAGA", "COBRO", "INTERES", "LIMITE", "RESUMEN",
    "ESTADO", "INFO", "AYUDA", "HELP", "VERSION", "REVERSA", "CANCELA", "PRESTAMO", "CAMBIO", "TITULAR",
]


def control(payload: str) -> int:
    """Port de control() en lib/service.ts (ids 4-23, 122-128)."""
    h = 0
    for ch in payload.upper():
        if "0" <= ch <= "9":
            h = (h * 10 + int(ch)) % 97
        elif "A" <= ch <= "Z":
            v = ord(ch) - 64
            h = (h * (100 if v >= 10 else 10) + v) % 97
    return 98 - (100 * h) % 97


def lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def esperado(nombre: str) -> dict:
    """Lo que daría el original si su conjunto fuera el nuestro (empate: orden alfabético, ids 456, 471)."""
    body = {"error": "E301", "mensaje": "comando desconocido "}
    cerca = sorted((lev(nombre.upper(), c), c) for c in CONOCIDOS)
    if cerca[0][0] <= 2:
        body["sugerencia"] = cerca[0][1]
    return body


def mensaje(nombre: str) -> str:
    payload = f"{nombre};X"  # un argumento: si el nombre existe con otra aridad, sale E302 (también es señal)
    return f"{payload};{control(payload)}"


def selftest():
    assert control("ALTA;Lucia") == 82 and control("ALTA;Mateo") == 3  # ids 3, 4
    assert esperado("CONSULT") == {"error": "E301", "mensaje": "comando desconocido ", "sugerencia": "CONSULTA"}  # id 365
    assert "sugerencia" not in esperado("SALDO")  # id 377
    assert esperado("ALNG")["sugerencia"] == "ALTA"  # id 471


def main():
    selftest()
    if "--selftest" in sys.argv:
        return print("selftest ok")
    before = sum(1 for line in LOG.open() if line.strip())
    msgs = [mensaje(n) for n in CANDIDATOS]
    subprocess.run([sys.executable, str(ROOT / "tools/probe.py"), "seq", "s-sondeo-comandos",
                    f"Detector de comandos nuevos: {len(msgs)} candidatos con control correcto (Q9a)", *msgs],
                   stdout=subprocess.DEVNULL, check=True)
    rows = [json.loads(line) for line in LOG.open() if line.strip()][before + 1:]  # sin el reset
    hallazgos = []
    for n, m, r in zip(CANDIDATOS, msgs, rows):
        exp = esperado(n)
        if (r["status"], r["response"]) != (400, exp):
            hallazgos.append({"id": r["id"], "m": m, "esperado": [400, exp], "hoy": [r["status"], r["response"]]})
    for h in hallazgos:
        print(json.dumps(h, ensure_ascii=False))
    print(f"sondeo: {len(msgs)} candidatos, {len(hallazgos)} hallazgos", file=sys.stderr)
    sys.exit(1 if hallazgos else 0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # una caída no es "comando nuevo": 1 queda reservado para hallazgos
        print(f"sondeo caído: {e!r}", file=sys.stderr)
        sys.exit(2)
