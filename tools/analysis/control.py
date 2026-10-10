#!/usr/bin/env python3
"""Campo de control de la caja negra: fórmula deducida de material/pruebas/ejemplos.jsonl.

Confianza: CONFIRMADO C2 (log#4-23 reproducen los 20 ejemplos; log#123-128 deciden C2 en los bordes). Ningún request al original.

Fórmula (candidata C1, la que usamos):

    N       = número decimal formado concatenando, en orden, para cada carácter del
              PAYLOAD (todo el mensaje menos el último ';' y el control), en mayúsculas:
                dígito '0'-'9'  -> ese dígito
                letra  'A'-'Z'  -> su posición 1..26 escrita en decimal (A=1 ... Z=26,
                                   2 dígitos desde la J: J=10 ... Z=26)
                cualquier otro (';', '-', ...) -> se ignora
    control = (1 - 3*N) mod 97          # == 98 - ((N*100) mod 97) salvo N*3 mod 97 in {0,1}
    el mensaje es válido  <=>  (N*100 + control) mod 97 == 1   # ISO 7064 MOD 97-10, estilo IBAN

Es decir: IBAN-checksum con A=1..Z=26 en vez de A=10..Z=35 y sin mover nada de sitio.
Se calcula en una pasada con h = (h*10^len(v) + v) mod 97, sin enteros grandes.

Qué los ejemplos NO deciden (ver spec/arquitectura.md, preguntas Q1-Q3):
  - C1 (rango 0..96) vs C2 (98 - x, rango 2..98): solo difieren si 3N mod 97 in {0,1}.
  - igualdad estricta vs congruencia módulo 97 (¿se acepta control+97?), ceros a la izquierda.
  - cómo trata el servicio espacios, '.', '_', acentos, etc. (aquí se ignoran todos los no-[A-Z0-9]).

Uso:
  python3 tools/analysis/control.py                         # self-check (assert sobre los 20 ejemplos)
  python3 tools/analysis/control.py msg "PING" "ALTA;Lucia"  # imprime mensajes completos con control
  python3 tools/analysis/control.py find 0 "CONSULTA;AC-{:04d}" 3000   # plantillas con control == 0
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EJEMPLOS = ROOT / "material" / "pruebas" / "ejemplos.jsonl"
M = 97


def digits(payload: str) -> str:
    """El 'número' N como string decimal (para depurar)."""
    out = []
    for ch in payload.upper():
        if "0" <= ch <= "9":
            out.append(ch)
        elif "A" <= ch <= "Z":
            out.append(str(ord(ch) - 64))
    return "".join(out)


def n_mod(payload: str) -> int:
    """N mod 97 sin enteros grandes (equivale a int(digits(payload) or '0') % 97)."""
    h = 0
    for ch in digits(payload):
        h = (h * 10 + int(ch)) % M
    return h


def control_c1(payload: str) -> int:
    """C1 (REFUTADA por log#123-128): (1 - 3N) mod 97, rango 0..96. Solo para documentar."""
    return (1 - 3 * n_mod(payload)) % M


def control_c2(payload: str) -> int:
    """C2 (CONFIRMADA, log#123-128): 98 - (100N mod 97), rango 2..98. Igual a C1 salvo cuando 3N mod 97 in {0,1}."""
    return 98 - (3 * n_mod(payload)) % M


control = control_c2  # fórmula vigente; el servicio la exige como entero de 1-2 dígitos (log#111-121), salvo PING (log#47-62)


def is_valid(payload: str, c: int) -> bool:
    """Criterio por congruencia (acepta c y c+97): (100N + c) mod 97 == 1."""
    return (100 * n_mod(payload) + c) % M == 1


def msg(payload: str) -> str:
    return f"{payload};{control(payload)}"


def split(m: str):
    """('payload', 'control_str') partiendo por el ÚLTIMO ';'."""
    payload, _, c = m.rpartition(";")
    return payload, c


# --- candidatas descartadas: se dejan para que el self-check documente por qué no valen ---
def _sum_mod(payload, mod):
    return sum(payload.upper().encode()) % mod


def _ascii_concat_mod97(payload):  # ASCII decimal concatenado: base 100 por carácter
    return (1 - 3 * int("".join(str(ord(c)) for c in payload.upper().replace(";", ""))) ) % M


def _acumulado_base10(payload):  # h = h*10 + v (sin desplazar por el ancho de v)
    h = 0
    for ch in payload.upper():
        if "0" <= ch <= "9":
            h = (h * 10 + int(ch)) % M
        elif "A" <= ch <= "Z":
            h = (h * 10 + ord(ch) - 64) % M
    return (1 - 3 * h) % M


def selfcheck():
    rows = [json.loads(l) for l in EJEMPLOS.read_text().splitlines() if l.strip()]
    assert len(rows) == 20
    ok = 0
    for r in rows:
        payload, c = split(r["request"]["m"])
        n = r["n"]
        if n == 17:  # E201 'control mal formado': "5X" no es número
            assert not c.isdigit() and r["response"]["error"] == "E201"
            # el control "bien formado" que habría que mandar es el de ej#18
            assert control(payload) == 35
        elif n == 2:  # E202 'control inválido': 83 != 82
            assert c.isdigit() and int(c) == 83 and control(payload) == 82 and not is_valid(payload, 83)
            assert r["response"]["error"] == "E202"
        else:
            assert c.isdigit() and int(c) == control(payload), (n, payload, c, control(payload))
            assert is_valid(payload, int(c)) and control_c2(payload) == int(c)
            ok += 1
    assert ok == 18  # los 18 restantes cuadran con la fórmula (incl. errores E301/E302/E401/E506/E507)

    # Case-insensitive: "CONSULTa" y "CONSULTA" dan el mismo control (ej#11 vs ej#5).
    assert control("CONSULTa;AC-0001") == control("CONSULTA;AC-0001") == 14
    # PING: ej#1.
    assert control("PING") == 64
    # Propiedad de C1 (NO evidencia: solo ';' y '-' aparecen en los ejemplos): lo que no es [A-Z0-9] no pesa.
    assert control("CONSULTA;AC-0001") == control("CONSULTA AC0001")
    # n_mod == módulo del entero grande
    for r in rows:
        p, _ = split(r["request"]["m"])
        assert n_mod(p) == int(digits(p) or "0") % M

    # Candidatas que los ejemplos refutan (cada una falla en >=1 ejemplo válido).
    def falla(fn):
        return any(fn(split(r["request"]["m"])[0]) != int(split(r["request"]["m"])[1])
                   for r in rows if r["n"] not in (2, 17))
    assert falla(lambda p: _sum_mod(p, 97)) and falla(lambda p: _sum_mod(p, 100))
    assert falla(_ascii_concat_mod97)   # ASCII concatenado (base 100)
    assert falla(_acumulado_base10)     # acumulado sin desplazar por ancho de v
    # Lo que desempata C1/C2 todavía no está observado: ningún ejemplo tiene 3N mod 97 in {0,1}.
    assert all((3 * n_mod(split(r["request"]["m"])[0])) % M not in (0, 1) for r in rows)
    print("selfcheck OK: 18/18 controles válidos cuadran; n=2 (83 vs 82) y n=17 ('5X') cuadran como errores.")


def find(c0: int, template: str, upto: int):
    """Plantillas template.format(i) cuyo control == c0 (para construir los casos borde de Q1)."""
    for i in range(upto):
        p = template.format(i)
        if control(p) == c0:
            print(p)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        selfcheck()
    elif a[0] == "msg":
        for p in a[1:]:
            print(msg(p))
    elif a[0] == "find":
        find(int(a[1]), a[2], int(a[3]))
    else:
        sys.exit(__doc__)
