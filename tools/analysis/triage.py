#!/usr/bin/env python3
"""Triage de experimentos.jsonl -> spec/triage.md. Solo lee el log; no hace requests.

  python3 tools/analysis/triage.py [--log RUTA] [--out RUTA]

Secciones del informe:
  1. Por seq: rango de ids, hipotesis, nº de registros, conclusiones (con id).
  2. Catalogo de respuestas unicas (status, cuerpo) con ids y ejemplo de request;
     codigos E### con su mensaje exacto.
  3. Contradicciones:
     A. mismo request tras el mismo prefijo desde el ultimo /__reset (o inicio del log)
        con respuestas distintas;
     B. mismo request aislado (metodo, ruta, cuerpo, auth) con respuestas distintas:
        ruido esperable por estado, pero marca dependencia de estado o de version.
  4. Comandos vistos (agrupados sin distinguir mayusculas ni espacios) y aridades.

Limitacion: el log no registra el token. Si dos tokens se intercalan en una misma
secuencia, el prefijo no es fiel al estado y A puede dar falsos positivos.
"""
import argparse
import json
from collections import OrderedDict, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LOG = ROOT / "experimentos.jsonl"
DEFAULT_OUT = ROOT / "spec" / "triage.md"


def load(path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    rows.sort(key=lambda r: r["id"])
    return rows


def esc(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def method_path(r):
    return (r.get("method") or "POST", r.get("path") or "/msg")


def req_key(r):
    """Identidad de la peticion: metodo, ruta, cuerpo canonico, auth."""
    method, path = method_path(r)
    body = r.get("request")
    if body is None:
        bk = None
    elif isinstance(body, str):
        bk = ("raw", body)
    else:
        bk = ("json", json.dumps(body, sort_keys=True, ensure_ascii=False))
    return (method, path, bk, r.get("auth_sent") or "")


def req_text(r):
    method, path, bk, auth = req_key(r)
    txt = f"{method} {path}"
    if bk is not None:
        body = repr(bk[1]) if bk[0] == "raw" else bk[1]
        if len(body) > 120:  # cuerpos enormes (p. ej. nombres de 20000 caracteres): solo el inicio
            body = body[:80] + f"...(+{len(body) - 80} chars)"
        txt += " " + body
    if auth:
        txt += f" [auth={auth!r}]"
    return txt


def resp_key(r):
    v = r["response"]
    if isinstance(v, str):
        return (r["status"], "text", v)
    return (r["status"], "json", json.dumps(v, sort_keys=True, ensure_ascii=False))


def resp_text(r):
    v = r["response"]
    return repr(v) if isinstance(v, str) else json.dumps(v, ensure_ascii=False)


def is_reset(r):
    return method_path(r) == ("POST", "/__reset")


def resp_label(k):
    return f"{k[0]} {k[2] if k[1] == 'json' else repr(k[2])}"


def section_seqs(rows):
    seqs = OrderedDict()
    for r in rows:
        seqs.setdefault(r["seq"], []).append(r)
    out = ["## 1. Por seq", "",
           "| seq | ids | hipotesis | nº registros | conclusiones (id) |",
           "|---|---|---|---|---|"]
    for seq, rs in seqs.items():
        ids = [r["id"] for r in rs]
        hyps = list(OrderedDict.fromkeys(r.get("hipotesis") or "-" for r in rs))
        concl = [f"({r['id']}) {r['conclusion']}" for r in rs if r.get("conclusion")]
        out.append(f"| {esc(seq)} | {min(ids)}-{max(ids)} | {esc(' / '.join(hyps))} | "
                   f"{len(rs)} | {esc(' · '.join(concl)) or '-'} |")
    out.append("")
    return out


def section_catalog(rows):
    groups = OrderedDict()
    for r in sorted(rows, key=lambda r: (r["status"], r["id"])):
        groups.setdefault(resp_key(r), []).append(r)
    out = ["## 2. Catalogo de respuestas unicas", "",
           f"Respuestas unicas (status, cuerpo): **{len(groups)}**. Cuerpo JSON con claves "
           "ordenadas para comparar; se muestra tal como quedo en el log.", "",
           "| status | cuerpo | nº | ids | ejemplo de request |",
           "|---|---|---|---|---|"]
    for k, rs in groups.items():
        ids = ", ".join(str(r["id"]) for r in rs)
        out.append(f"| {k[0]} | `{esc(resp_text(rs[0]))}` | {len(rs)} | {ids} | "
                   f"`{esc(req_text(rs[0]))}` |")
    out.append("")

    codes = defaultdict(lambda: defaultdict(list))
    for r in rows:
        v = r["response"]
        if isinstance(v, dict) and "error" in v:
            msg = v.get("mensaje")
            extra = " + sugerencia" if "sugerencia" in v else ""
            codes[v["error"]][(repr(msg) + extra)].append(r)
    out += ["### Codigos de error", "",
            "| codigo | mensaje exacto | status | ids | ojo |", "|---|---|---|---|---|"]
    for code in sorted(codes):
        variants = codes[code]
        for msg, rs in variants.items():
            statuses = sorted({r["status"] for r in rs})
            ids = ", ".join(str(r["id"]) for r in rs)
            warn = "varios mensajes para el mismo codigo" if len(variants) > 1 else ""
            out.append(f"| {code} | `{esc(msg)}` | {statuses} | {ids} | {warn} |")
    out.append("")
    return out, codes


def section_contradictions(rows):
    # A: mismo prefijo de peticiones desde el ultimo /__reset (incluido) o inicio del log.
    by_prefix = OrderedDict()
    prefix = ()
    for r in rows:
        key = req_key(r)
        prefix = (key,) if is_reset(r) else prefix + (key,)
        by_prefix.setdefault(prefix, []).append(r)
    contra_a = [(p, rs) for p, rs in by_prefix.items()
                if len({resp_key(r) for r in rs}) > 1]

    # B: misma peticion aislada, respuestas distintas.
    by_req = OrderedDict()
    for r in rows:
        by_req.setdefault(req_key(r), []).append(r)
    contra_b = [(k, rs) for k, rs in by_req.items()
                if len({resp_key(r) for r in rs}) > 1]

    out = ["## 3. Contradicciones", "",
           "Aviso: probe.py solo registra `auth_sent` cuando se pasa `--auth-raw`; un `--no-auth` "
           "queda igual que una peticion con token. Las filas con 401 E001 pueden ser ese caso y "
           "no una contradiccion real. Revisar contra la conclusion de cada id.", "",
           "### A. Mismo request tras el mismo prefijo desde /__reset", ""]
    if contra_a:
        out += ["| prefijo (longitud) | request | ids | respuestas |", "|---|---|---|---|"]
        for p, rs in contra_a:
            detail = "; ".join(f"{r['id']}: {esc(resp_text(r))}" for r in rs)
            out.append(f"| {len(p)} | `{esc(req_text(rs[-1]))}` | "
                       f"{', '.join(str(r['id']) for r in rs)} | {esc(detail)} |")
    else:
        out.append("Ninguna.")
    out += ["", "### B. Misma peticion aislada con respuestas distintas (revisar: estado o version)", ""]
    if contra_b:
        out += ["| request | ids | respuestas |", "|---|---|---|"]
        for k, rs in contra_b:
            detail = "; ".join(f"{r['id']}: {r['status']} {esc(resp_text(r))}" for r in rs)
            out.append(f"| `{esc(req_text(rs[0]))}` | "
                       f"{', '.join(str(r['id']) for r in rs)} | {esc(detail)} |")
    else:
        out.append("Ninguna.")
    out.append("")
    return out, len(contra_a), len(contra_b)


def parse_m(r):
    body = r.get("request")
    if isinstance(body, dict) and isinstance(body.get("m"), str):
        return body["m"]
    return None


def section_commands(rows):
    cmds = OrderedDict()
    skipped = 0
    for r in rows:
        m = parse_m(r)
        if m is None:
            if method_path(r)[1] == "/msg":
                skipped += 1
            continue
        segs = m.split(";")
        raw_cmd = segs[0]
        arity = len(segs) - 2 if len(segs) >= 2 else None
        c = cmds.setdefault(raw_cmd.strip().upper() or "(vacio)", {"variants": set(), "arities": set(),
                                                      "statuses": set(), "ids": []})
        c["variants"].add(raw_cmd)
        c["arities"].add("sin control" if arity is None else str(arity))
        c["statuses"].add(r["status"])
        c["ids"].append(r["id"])
    out = ["## 4. Comandos y aridades", "",
           "Aridad = nº de segmentos entre el comando y el control (`CMD;a1;...;control`). "
           "Agrupado sin distinguir mayusculas ni espacios.", "",
           "| comando | variantes vistas (raw) | aridades | status | nº | ids (muestra) |",
           "|---|---|---|---|---|---|"]
    for name, c in sorted(cmds.items()):
        variants = ", ".join(repr(v) for v in sorted(c["variants"]))
        ids = ", ".join(str(i) for i in c["ids"][:12]) + (" ..." if len(c["ids"]) > 12 else "")
        out.append(f"| {esc(name)} | {esc(variants)} | {', '.join(sorted(c['arities']))} | "
                   f"{sorted(c['statuses'])} | {len(c['ids'])} | {ids} |")
    out.append("")
    if skipped:
        out.append(f"Registros /msg sin campo `m` en string (no contados aqui): {skipped}.")
        out.append("")
    return out, cmds


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--log", default=str(DEFAULT_LOG))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    rows = load(Path(args.log))
    seq_sec = section_seqs(rows)
    cat_sec, codes = section_catalog(rows)
    con_sec, n_a, n_b = section_contradictions(rows)
    cmd_sec, cmds = section_commands(rows)

    unique = len({resp_key(r) for r in rows})
    header = ["# Triage del log de experimentos", "",
              f"Registros: {len(rows)} (ids {rows[0]['id']}-{rows[-1]['id']}). "
              "Generado por `tools/analysis/triage.py`; no editar a mano.", ""]
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(header + seq_sec + cat_sec + con_sec + cmd_sec), encoding="utf-8")

    print(f"registros={len(rows)} respuestas_unicas={unique} "
          f"contradicciones_A={n_a} candidatas_B={n_b} comandos={len(cmds)}")
    for code in sorted(codes):
        for msg in codes[code]:
            print(f"  {code} {msg}")
    print(f"escrito: {out_path}")


if __name__ == "__main__":
    main()
