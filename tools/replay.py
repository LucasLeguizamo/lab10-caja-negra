#!/usr/bin/env python3
"""Reproduce experimentos.jsonl (y material/pruebas/ejemplos.jsonl) contra un reemplazo y compara como el evaluador.

  python3 tools/replay.py http://localhost:3000 [--fail-fast]   # servidor ARRANCADO DE CERO (X-Req acumula desde 1)
  python3 tools/replay.py --selftest                             # solo el self-check del comparador
  REPLAY_TOKEN=... (debe coincidir con TEAM_TOKEN del servidor; por defecto "test-token")

Nunca habla con el original. Sale con codigo != 0 si hay cualquier diferencia (con --fail-fast, en la primera).

Comparacion (como el evaluador): mismo status y mismo cuerpo. Si el esperado es JSON: se parsea el obtenido y se
compara recursivamente con tipos estrictos (True != 1, 1 != 1.0), claves sin orden, arrays en orden. Si el esperado
es texto (el log guarda str cuando no era JSON): texto exacto, caracter por caracter, sin parsear el obtenido.
Un fallo de red o un paso >= 5 s cuenta como diferencia. Las filas con `infra` se ignoran.

Auth por fila, en este orden:
  1. campo `auth` del log: none -> sin header; team -> token del equipo (REPLAY_TOKEN); bearer/raw -> `auth_sent` tal cual
     (incluido el vacio).
  2. filas heredadas (sin `auth`, id <= LEGACY_MAX_ID): tabla LEGACY_AUTH o `auth_sent`; los 401 sin dato se prueban con
     TODAS las variantes sin credencial valida y deben dar la misma respuesta. Cuentan como "inferidas".
  3. fila sin `auth` con id > LEGACY_MAX_ID: error de uso (aborta), no se adivina.
Estado entre seqs: una seq cuya primera fila es POST /__reset empieza de cero (se reproduce ese reset). Una seq SIN reset
inicial en el log se mando en el original sobre el estado que dejo la anterior (p.ej. q5c continua q5b), asi que NO se
resetea por su cuenta: hereda el estado de la seq previa (orden de primera aparicion). Si ademas manda algo mas que
PING/rutas sin estado, se lista como "hereda estado (log ambiguo)". Solo se hace un reset de cortesia antes de la 1a seq.
"""
import http.client
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
TOKEN = os.environ.get("REPLAY_TOKEN", "test-token")
SCHEME = "Bearer"
TIMEOUT = 5.0
LEGACY_MAX_ID = 150  # el campo `auth` empezo en el id 151

# Filas heredadas: que se mando realmente (por hipotesis/conclusion de cada fila). Lo no listado y con 401 -> variantes.
NONE, INVALID, EMPTY = "none", "invalid", "empty"
LEGACY_AUTH = {
    **{i: NONE for i in (1, 37, 70, 71, 94, 69, 72, 73, 74, 75, 77, 89, 90, 91, 92, 93)},
    **{i: INVALID for i in (38, 96, 100, 103, 104, 105, 106)},
    **{i: EMPTY for i in (95, 99)},
}
NO_CRED_VARIANTS = [None, "", f"{SCHEME} ", f"{SCHEME} token-invalido"]


def load(p):
    return [json.loads(l) for l in Path(p).read_text(encoding="utf-8").splitlines() if l.strip()]


# ---------- comparador estricto ----------
def strict_eq(a, b):
    """Igualdad como el evaluador: tipos identicos, dict sin orden de claves, list en orden."""
    if type(a) is not type(b):
        return False
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(strict_eq(a[k], b[k]) for k in a)
    if isinstance(a, list):
        return len(a) == len(b) and all(strict_eq(x, y) for x, y in zip(a, b))
    return a == b


def same_body(expected, raw_text):
    if isinstance(expected, str):  # el log guarda str cuando el original no era JSON: texto exacto
        return raw_text == expected
    try:
        got = json.loads(raw_text)
    except ValueError:
        return False
    return strict_eq(expected, got)


def selftest():
    assert strict_eq({"a": 1, "b": 2}, {"b": 2, "a": 1}), "claves en otro orden deben ser iguales"
    assert strict_eq({"x": {"p": 1, "q": [1, 2]}}, {"x": {"q": [1, 2], "p": 1}}), "orden de claves anidado"
    assert not strict_eq({"a": [1, 2]}, {"a": [2, 1]}), "array en otro orden debe ser distinto"
    assert not strict_eq([1, 2], [1, 2, 3]), "arrays de largo distinto"
    assert not strict_eq({"ok": True}, {"ok": 1}), "true != 1"
    assert not strict_eq({"s": 1}, {"s": 1.0}), "1 != 1.0"
    assert not strict_eq({"s": 0}, {"s": False}), "0 != false"
    assert not strict_eq({"a": 1}, {"a": 1, "b": 2}), "clave extra"
    assert not strict_eq({"a": "1"}, {"a": 1}), "string != number"
    assert same_body({"a": 1, "b": 2}, '{"b":2,"a":1}'), "JSON: claves sin orden"
    assert not same_body({"a": [1, 2]}, '{"a":[2,1]}'), "JSON: arrays en orden"
    assert same_body("", ""), "texto vacio igual"
    assert not same_body("x", '"x"'), "esperado texto: no se parsea el obtenido"
    assert not same_body("hola ", "hola"), "texto exacto (espacio final cuenta)"
    assert not same_body({"a": 1}, "no es json"), "esperado JSON, obtenido texto"
    assert same_body({"m": "comando desconocido "}, '{"m":"comando desconocido "}'), "espacio final en JSON se conserva"
    assert not same_body({"m": "comando desconocido "}, '{"m":"comando desconocido"}'), "espacio final distinto"
    return True


# ---------- red ----------
def send(base, method, path, body, auth):
    u = urlsplit(base)
    h = {"Content-Type": "application/json"}
    if auth is not None:
        h["Authorization"] = auth
    t0 = time.monotonic()
    c = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=TIMEOUT)  # http.client no sigue redirecciones
    try:
        c.request(method, path, body=body.encode("utf-8") if body is not None else None, headers=h)
        r = c.getresponse()
        raw = r.read()
        return r.status, raw.decode("utf-8", "replace"), r.getheader("X-Req"), time.monotonic() - t0, None
    except (OSError, http.client.HTTPException) as e:  # timeout, conexion rechazada, respuesta rota
        return None, "", None, time.monotonic() - t0, f"{type(e).__name__}: {e}"
    finally:
        c.close()


def valid_auth():
    return f"{SCHEME} {TOKEN}"


def auths_for(e, stats):
    """Lista de variantes de Authorization a probar para la fila (None = sin header). Todas deben dar lo esperado."""
    a = e.get("auth")
    if a == "none":
        return [None]
    if a == "team":
        return [valid_auth()]
    if a in ("bearer", "raw"):
        return [e["auth_sent"]]
    if a is not None:
        sys.exit(f"fila {e['id']}: valor de auth desconocido {a!r}")
    # fila heredada
    if e.get("id", 0) > LEGACY_MAX_ID and e.get("src") == "log":
        sys.exit(f"fila {e['id']} sin campo `auth` y con id > {LEGACY_MAX_ID}: el log esta incompleto, no se adivina")
    stats["inferidas"] += 1
    if e.get("auth_sent") is not None:
        return [e["auth_sent"]]
    k = LEGACY_AUTH.get(e["id"])
    if k == NONE:
        return [None]
    if k == INVALID:
        return [f"{SCHEME} token-invalido"]
    if k == EMPTY:
        return [f"{SCHEME} "]
    if e["status"] == 401:
        return NO_CRED_VARIANTS  # no sabemos que credencial invalida se mando: todas deben dar 401
    return [valid_auth()]


def body_for(e):
    if "body_raw" in e:  # probe.py lo guarda tal cual cuando el cuerpo no es un objeto JSON
        return e["body_raw"]
    r = e.get("request")
    if r is None:
        return None
    return r if isinstance(r, str) else json.dumps(r, ensure_ascii=False)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fail_fast = "--fail-fast" in sys.argv
    selftest()
    if "--selftest" in sys.argv:
        print("self-check del comparador: OK")
        return
    base = (args[0] if args else "http://localhost:3000").rstrip("/")

    log = [{**e, "src": "log"} for e in load(ROOT / "experimentos.jsonl")]
    seqs = {}
    for e in log:  # agrupa por seq en orden de primera aparicion
        seqs.setdefault(e["seq"], []).append(e)
    ej = [{**e, "seq": "ejemplos", "src": "ej", "auth": "team"} for e in load(ROOT / "material/pruebas/ejemplos.jsonl")]
    reset_row = {"id": 0, "seq": "ejemplos", "src": "ej", "auth": "team", "method": "POST", "path": "/__reset",
                 "request": None, "status": 200, "response": {"ok": True}}
    groups = list(seqs.items()) + [("ejemplos", [reset_row] + ej)]  # los ejemplos se grabaron "tras empezar de cero"

    stats = {"inferidas": 0, "infra": 0, "pasos": 0, "ok": 0}
    difs = []
    xbad = 0
    heredan = []

    def dif(e, msg_):
        difs.append(e["id"] if e["src"] == "log" else f"ej{e['id']}")
        print(f"DIF {e['src']}#{e['id']} {e.get('method', 'POST')} {e.get('path', '/msg')} req={cut(e.get('request'))}\n    {msg_}")
        if fail_fast:
            print(f"\nprimera diferencia: {difs[0]}; abortado por --fail-fast")
            sys.exit(1)

    def cut(v):
        return json.dumps(v, ensure_ascii=False)[:200]  # el log tiene mensajes de miles de caracteres

    for seq, rows in groups:
        first = rows[0]
        has_reset = first.get("method") == "POST" and first.get("path") == "/__reset" and first["status"] == 200
        if seq == groups[0][0] and not has_reset:
            send(base, "POST", "/__reset", None, valid_auth())
        elif not has_reset and any(r.get("method", "POST") == "POST" and r.get("path", "/msg") == "/msg" and r["status"] != 401 and r.get("src") == "log"
                                   and not str((r.get("request") or {}).get("m", "") if isinstance(r.get("request"), dict) else "").upper().startswith("PING")
                                   for r in rows):
            heredan.append((seq, [r["id"] for r in rows][:1]))
        for e in rows:
            if "infra" in e:
                stats["infra"] += 1
                continue
            method, path = e.get("method", "POST"), e.get("path", "/msg")
            variants = auths_for(e, stats)
            if e.get("auth") == "team" and e["status"] == 401:
                dif(e, "contradiccion en el log: auth=team pero el original respondio 401")
                continue
            for a in variants:
                status, text, x, dt, err = send(base, method, path, body_for(e), a)
                stats["pasos"] += 1
                tag = "" if len(variants) == 1 else f" [auth={a!r}]"
                if err:
                    dif(e, f"ERROR de red/timeout{tag}: {err} ({dt:.1f}s)")
                elif dt >= TIMEOUT:
                    dif(e, f"paso lento{tag}: {dt:.1f}s >= {TIMEOUT}s")
                elif status != e["status"] or not same_body(e["response"], text):
                    dif(e, f"esperado {e['status']} {cut(e['response'])}\n    obtenido {status} {text[:200]!r}{tag}")
                else:
                    stats["ok"] += 1
                    if e["src"] == "log" and a == variants[0] and str(e.get("x_req")) != str(x) \
                            and not (e.get("x_req") is None and x is None):
                        xbad += 1  # informativo: el set no compara headers
    total = stats["pasos"]
    print(f"\nself-check del comparador: OK | filas infra ignoradas: {stats['infra']} | "
          f"filas con auth inferida (heredadas): {stats['inferidas']} | X-Req distintos (informativo): {xbad}")
    for sq, ids in heredan:
        print(f"  aviso: seq {sq} (desde id {ids[0]}) no empieza con reset: hereda el estado de la seq anterior (log ambiguo)")
    if difs:
        print(f"DIFERENCIAS en {len(difs)} pasos: {difs}")
        print(f"paridad status+cuerpo: {stats['ok']}/{total} = {100 * stats['ok'] / total:.1f}%")
        sys.exit(1)
    print(f"identico en {total} de {total} pasos")


if __name__ == "__main__":
    main()
