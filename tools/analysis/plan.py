#!/usr/bin/env python3
"""Plan de recon de system-designer: secuencias EXACTAS (con control calculado) para contestar
las preguntas abiertas de spec/arquitectura.md. No hace requests: solo genera mensajes.

  python3 tools/analysis/plan.py list                 # ids, prioridad, nº de mensajes
  python3 tools/analysis/plan.py show Q4b             # mensajes de una pregunta
  python3 tools/analysis/plan.py probe Q4b            # comando(s) de tools/probe.py listos para pegar
  python3 tools/analysis/plan.py md                   # bloques markdown (los que van en la spec)

Todos los controles salen de tools/analysis/control.py (fórmula C1, confianza probable). Si una
secuencia devuelve E202 donde el plan no lo espera, la fórmula (o el mapeo de caracteres, Q8) está mal:
parar y ejecutar Q1/Q8 antes de seguir.
"""
import shlex
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from control import control, control_c1, msg, EJEMPLOS  # noqa: E402
import json  # noqa: E402

A1, A2 = "AC-0001", "AC-0002"


def bad(payload):  # bien formado pero con control equivocado (nunca coincide con C1 ni C2)
    c = control(payload)
    w = (c + 7) % 97
    return f"{payload};{w}"


def mal(payload):  # control mal formado
    return f"{payload};5X"


def with_c(payload, c):  # control explícito
    return f"{payload};{c}"


def first_with(c0, tpl="CONSULTA;AC-{:04d}"):
    for i in range(10000):
        p = tpl.format(i)
        if control_c1(p) == c0:  # Q1b ya ejecutada (log#122-128): solo reproducibilidad
            return p
    raise SystemExit("sin plantilla")


SETUP2 = [msg("ALTA;Lucia"), msg("ALTA;Mateo")]  # AC-0001, AC-0002 (como ej#3, ej#4)
DEP = lambda a, n: msg(f"DEPOSITO;{a};{n}")  # noqa: E731
TRF = lambda a, b, n: msg(f"TRANSFER;{a};{b};{n}")  # noqa: E731

PLAN = []  # cada entrada: id, prio, seq, hip, kind ('seq'|'raw'), items


def add(id_, prio, seq, hip, items, kind="seq"):
    PLAN.append(dict(id=id_, prio=prio, seq=seq, hip=hip, kind=kind, items=items))


# ---------------- P0 ----------------
add("Q1a", 0, "q1a-control-forma",
    "Forma aceptada del campo de control (E201 vs E202 vs aceptado); PING como vehículo",
    ["PING;64", "PING;65", "PING;XX", "PING;", "PING", "PING;064", "PING;0064", "PING;+64", "PING; 64",
     "PING;64 ", "PING;161", "PING;-33", "PING;64.0", "PING;64;", ";64", "64"])

p0, p1, p2 = first_with(0), first_with(1), first_with(2)
add("Q1b", 0, "q1b-control-borde",
    "C1 (0..96) vs C2 (2..98) vs congruencia mod 97: payloads cuyo control C1 es 0, 1, 2 y sus +97",
    [with_c(p0, 0), with_c(p0, 97), with_c(p1, 1), with_c(p1, 98), with_c(p2, 2), with_c(p2, 99)])

setup1 = [msg("ALTA;Lucia")]
add("Q2", 0, "q2-precedencia",
    "Orden control/comando/aridad/entidad: cada mensaje rompe DOS cosas a la vez",
    setup1 + [
        bad("SALDOS;AC-0001"), mal("SALDOS;AC-0001"), "SALDOS;AC-0001",
        bad("ALTA;Lucia;Gomez"), mal("ALTA;Lucia;Gomez"),
        bad("CONSULTA;AC-0009"), mal("CONSULTA;AC-0009"),
        bad("CONSULTA"), msg("CONSULTA"),
        bad("FOO"), msg("FOO"),
    ])

RAW = [
    ("POST", "/msg", "", "cuerpo vacío"),
    ("POST", "/msg", "{", "JSON roto"),
    ("POST", "/msg", "[]", "array en vez de objeto"),
    ("POST", "/msg", "{}", "sin m"),
    ("POST", "/msg", '{"m":5}', "m no string"),
    ("POST", "/msg", '{"m":null}', "m null"),
    ("POST", "/msg", '{"m":""}', "m vacío"),
    ("POST", "/msg", '{"M":"PING;64"}', "clave en mayúscula"),
    ("POST", "/msg", '{"m":"PING;64","x":1}', "clave extra"),
    ("POST", "/msg", '"PING;64"', "string JSON"),
    ("POST", "/msg", "m=PING;64", "form"),
    ("GET", "/msg", None, "GET /msg"),
    ("PUT", "/msg", '{"m":"PING;64"}', "PUT /msg"),
    ("OPTIONS", "/msg", None, "OPTIONS /msg"),
    ("POST", "/msg/", '{"m":"PING;64"}', "slash final"),
    ("POST", "/MSG", '{"m":"PING;64"}', "mayúsculas en la ruta"),
    ("POST", "/msg?x=1", '{"m":"PING;64"}', "query string"),
    ("GET", "/health", None, "con token"),
    ("POST", "/health", None, "método incorrecto"),
    ("GET", "/__reset", None, "GET en la ruta de reset"),
    ("POST", "/__reset", None, "forma del cuerpo de /__reset"),
    ("GET", "/", None, "raíz con token"),
    ("GET", "/nada", None, "ruta inexistente con token"),
    ("POST", "/nada", '{"m":"PING;64"}', "POST a ruta inexistente"),
    ("GET", "/nada --no-auth", None, "ruta inexistente SIN token"),
    ("POST", "/msg --no-auth", '{"m":"PING;64"}', "/msg sin token"),
    ("POST", "/__reset --no-auth", None, "reset sin token"),
    ("POST", "/msg --token invalido", '{"m":"PING;64"}', "token inválido (¿mismo E001?)"),
    ("GET", "/health --token invalido", None, "health con token inválido"),
]
add("Q3", 0, "q3-entrada",
    "Rutas, métodos, forma del cuerpo y auth fuera del camino feliz (probe.py raw, uno por request)",
    RAW, kind="raw")

# ---------------- P1 ----------------
add("Q4a", 1, "q4a-deposito-limite",
    "¿DEPOSITO tiene límite por operación? ¿E506 también ahí? (ej#6 aceptó 250000)",
    [msg("ALTA;Lucia"), DEP(A1, 250000), DEP(A1, 1000000), DEP(A1, 10000000), DEP(A1, 100000000),
     msg(f"CONSULTA;{A1}")])

add("Q4b", 1, "q4b-limite-transfer",
    "E506: ¿tope por operación [100000,119999] (H1), acumulado [140000,159999] (H2) o % del saldo (H3)?",
    SETUP2 + [DEP(A1, 250000 + i) for i in range(4)] + [msg(f"CONSULTA;{A1}"),  # montos distintos: sin confundir con dedupe (Q10)
     TRF(A1, A2, 120000),   # H3 (57% del saldo): con saldo 1.000.000 pasaría; H1: E506
     TRF(A1, A2, 100001), TRF(A1, A2, 110000), TRF(A1, A2, 119999), TRF(A1, A2, 100000),
     TRF(A1, A2, 99999), TRF(A1, A2, 99998), TRF(A1, A2, 99997),  # acumulado ~400000: H2 muere si todo pasa
     msg(f"CONSULTA;{A1}"), msg(f"CONSULTA;{A2}")])

add("Q4c", 1, "q4c-transfer-precedencia",
    "Precedencia dentro de TRANSFER: cada paso viola dos reglas (límite, saldo, cuenta, misma cuenta)",
    SETUP2 + [DEP(A1, 50000),
              TRF(A1, A2, 500000),             # límite + saldo: E506 o E507
              TRF(A1, "AC-0009", 60000),       # destino inexistente + saldo
              TRF(A1, "AC-0009", 500000),      # destino inexistente + límite
              TRF("AC-0009", A2, 1000),        # origen inexistente
              TRF("AC-0009", "AC-0008", 1000),  # ambas inexistentes
              TRF(A1, A1, 1000),               # misma cuenta
              TRF(A1, A1, 60000),              # misma cuenta + saldo
              TRF(A1, A2, 0),                  # monto 0
              msg(f"CONSULTA;{A1}"), msg(f"CONSULTA;{A2}")])

AMT = ["0", "-5", "10.5", "abc", "", "1e3", "0100", "+100", " 100", "100 ", "1,000", "007",
       "9007199254740993", "99999999999999999999"]
amt_items = [msg("ALTA;Lucia")]
for a in AMT:
    amt_items += [msg(f"DEPOSITO;{A1};{a}"), msg(f"CONSULTA;{A1}")]
add("Q5", 1, "q5-gramatica-monto",
    "Qué es un monto válido y qué E50x/E4xx devuelve cada forma inválida (depende de Q8 para . , + -)",
    amt_items)

add("Q6a", 1, "q6a-anula-deposito",
    "ANULA sobre DEPOSITO: ¿revierte saldo? ¿qué devuelve con OP inexistente/mal formado?",
    [msg("ALTA;Lucia"), DEP(A1, 1000), msg("ANULA;OP-0001"), msg(f"CONSULTA;{A1}"), msg("ANULA;OP-0001"),
     msg("ANULA;OP-0099"), msg("ANULA;OP-1"), msg("ANULA;op-0001"), msg("ANULA;AC-0001"), msg("ANULA;"),
     msg("ANULA"), msg("ANULA;OP-0001;OP-0002"), DEP(A1, 5), msg(f"CONSULTA;{A1}")])

add("Q6b", 1, "q6b-anula-transfer-gastada",
    "ANULA de transfer cuyo destino ya gastó el dinero (¿saldo negativo? ¿E507? ¿ok:false?)",
    SETUP2 + [DEP(A1, 1000), TRF(A1, A2, 400),            # OP-0001, OP-0002
              TRF(A2, A1, 300),                           # OP-0003, A2 queda con 100
              msg("ANULA;OP-0002"), msg(f"CONSULTA;{A1}"), msg(f"CONSULTA;{A2}"),
              msg("ANULA;OP-0003"), msg("ANULA;OP-0002"), msg(f"CONSULTA;{A1}"), msg(f"CONSULTA;{A2}")])

add("Q7", 1, "q7-contadores-y-fallos",
    "¿Qué consume IDs? fallos E401/E302/E50x antes del éxito; ALTA duplicado; nombres límite",
    [msg("ALTA;Lucia"), msg("ALTA;Lucia"), msg("ALTA;Lucia;Gomez"), msg("ALTA;Ana"),
     DEP("AC-0099", 100), DEP("AC-0001", 100), TRF("AC-0001", "AC-0099", 1), DEP("AC-0001", 1),
     msg("ALTA;"), msg("ALTA;;"), msg("ALTA;ANA"), msg("ALTA;lucia"), msg("ALTA;" + "A" * 200)])

CH = [" ", ".", "_", ",", "+", "/", "#", "ñ", "é", "€"]
add("Q8a", 1, "q8a-caracteres-control",
    "Mapeo de caracteres no [A-Z0-9] en el control (C1 los ignora). E401 = control aceptado; E202 = peso distinto",
    [msg(f"CONSULTA;A{x}B") for x in CH] + [msg("CONSULTA;AB")])

add("Q8b", 1, "q8b-barrido-caracter",
    "PLANTILLA: para cada carácter X que dio E202 en Q8a, barrer control 0..98 sobre 'CONSULTA;AXB'; "
    "el único que dé E401 (no E202) revela 3N mod 97 y por tanto el valor de X",
    [f"CONSULTA;AXB;{c}" for c in range(0, 99)][:4] + ["... (hasta ;98)"], kind="plantilla")

for_scan = ["FOO", "", "ping", "PING ", " PING", "SALDO", "BALANCE", "SALDOS", "HELP", "AYUDA", "VERSION", "VER",
            "STATUS", "ESTADO", "HISTORIAL", "LISTA", "CUENTAS", "CUENTA", "BAJA", "RETIRO", "RETIRAR",
            "DEBITO", "CREDITO", "ECHO", "TIME", "HORA", "RESET", "INFO", "OPERACIONES", "OP", "CONSULTAR",
            "ANULAR", "REVERSA", "REVERTIR", "DEPOSITAR", "TRANSFERIR", "TRANSFERENCIA", "LIMITE", "LIMITES",
            "CLOSE", "CIERRE", "DUMP", "STATS", "ADMIN", "DEBUG", "MODIFICA", "BORRA", "ELIMINA"]
add("Q9a", 1, "q9a-comandos-desconocidos",
    "E301: ¿mensaje con cola variable? (ej#12 trae 'comando desconocido ' con espacio final); caso de la "
    "mayúscula/espacios; búsqueda de comandos ocultos (cualquier respuesta != 400 E301 es un hallazgo)",
    [msg(c) for c in for_scan])

ARIDAD = []
for cmd, ns in (("PING", (1, 2)), ("ALTA", (0, 2)), ("CONSULTA", (0, 2)), ("DEPOSITO", (0, 1, 3)),
                ("TRANSFER", (0, 1, 2, 4)), ("ANULA", (0, 2))):
    for n in ns:
        ARIDAD.append(msg(";".join([cmd] + ["AC-0001"] * n)))
add("Q9b", 1, "q9b-aridad",
    "Aridad de cada comando: nº de argumentos aceptados (ej#20: ALTA con 2 args -> E302)",
    [msg("ALTA;Lucia")] + ARIDAD)

# ---------------- P2 ----------------
add("Q10", 2, "q10-idempotencia",
    "¿Mensajes idénticos repetidos dedupican (idempotencia) o crean otra OP?",
    [msg("ALTA;Lucia"), DEP(A1, 700), DEP(A1, 700), msg(f"CONSULTA;{A1}"), msg(f"CONSULTA;{A1}")])

add("Q11", 2, "q11-ids-forma",
    "Sensibilidad a mayúsculas y forma de los IDs de cuenta",
    [msg("ALTA;Lucia"), msg("CONSULTA;ac-0001"), msg("CONSULTA;AC-1"), msg("CONSULTA;AC-00001"),
     msg("CONSULTA;AC0001"), msg("CONSULTA;AC-0001 "), msg("CONSULTA; AC-0001"), msg("CONSULTA;AC-0001-")])

add("Q13", 2, "q13-xreq",
    "X-Req (campo x_req del log): ¿contador por token? ¿lo reinicia /__reset? ¿cuentan los errores?",
    ["PING;64", "PING;64", bad("PING"), "PING;64"])

add("Q12c", 2, "q12-timer-anula",
    "¿Dependencia del tiempo? ANULA tras esperar (hacer ANULA a +60 s y +5 min con sleep entre mensajes)",
    [msg("ALTA;Lucia"), DEP(A1, 1000), "<esperar 60 s>", msg("ANULA;OP-0001"), msg(f"CONSULTA;{A1}")])

canary = [json.loads(l)["request"]["m"] for l in EJEMPLOS.read_text().splitlines() if l.strip()]
add("Q12", 2, "canario",
    "Canario de versión: los 20 ejemplos + 4 bordes; repetir cada hora y comparar con ejemplos.jsonl y la corrida previa",
    canary + ["PING;65", with_c(p0, 0), with_c(p0, 97), msg("CONSULTA;AC-0001;AC-0002")])

# ---------------- P3 ----------------
add("Q14", 3, "q14-tamanos",
    "Mensaje larguísimo, unicode, saltos de línea (límites de entrada)",
    [msg("ALTA;" + "A" * 5000), msg("ALTA;Ñandú"), msg("ALTA;Ana\nLópez")])


def probe_cmd(q):
    out = []
    if q["kind"] == "seq":
        out.append("python3 tools/probe.py seq " + shlex.quote(q["seq"]) + " " + shlex.quote(q["hip"]) + " \\\n    "
                   + " ".join(shlex.quote(m) for m in q["items"]))
    elif q["kind"] == "raw":
        for i, (meth, path, body, hip) in enumerate(q["items"], 1):
            p, *flags = path.split(" ")
            args = [shlex.quote(f"{q['seq']}-{i:02d}"), shlex.quote(hip), meth, shlex.quote(p)]
            args.append(shlex.quote(body) if body is not None else "")
            out.append("python3 tools/probe.py raw " + " ".join(a for a in args if a) + (" " + " ".join(flags) if flags else ""))
    return "\n".join(out)


def md_block(q):
    if q["kind"] == "raw":
        return "\n".join(f"{m:7} {p:22} {b if b is not None else '(sin cuerpo)':26} # {h}" for m, p, b, h in q["items"])
    return "\n".join(q["items"])


if __name__ == "__main__":
    a = sys.argv[1:]
    byid = {q["id"]: q for q in PLAN}
    if not a or a[0] == "list":
        for q in PLAN:
            print(f"{q['id']:5} P{q['prio']} {len(q['items']):3} msgs  {q['seq']}")
    elif a[0] == "show":
        print(md_block(byid[a[1]]))
    elif a[0] == "probe":
        print(probe_cmd(byid[a[1]]))
    elif a[0] == "md":
        for q in PLAN:
            print(f"### {q['id']}\n```\n{md_block(q)}\n```")
    else:
        sys.exit(__doc__)
