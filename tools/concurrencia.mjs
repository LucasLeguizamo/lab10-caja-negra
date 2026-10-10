// Chequeo del estado compartido: 20 ALTA en paralelo contra el REEMPLAZO deben dar AC-0001..AC-0020 sin huecos
// ni repetidos. Si el estado se parte entre instancias (o el lock falla) aparecen ids repetidos.
// Uso: TEAM_TOKEN=... node tools/concurrencia.mjs [url]   (nunca contra el original: no pasa por probe.py)
import { control } from "../lib/service.ts";

const base = (process.argv[2] ?? "http://localhost:3111").replace(/\/$/, "");
const auth = { authorization: `Bearer ${process.env.TEAM_TOKEN}`, "content-type": "application/json" };
const post = (path, body) => fetch(base + path, { method: "POST", headers: auth, body: JSON.stringify(body) });

await post("/__reset");
const N = 20;
const ids = await Promise.all(
  Array.from({ length: N }, async (_, i) => {
    const p = `ALTA;c${i}`;
    const r = await post("/msg", { m: `${p};${control(p)}` });
    return (await r.json()).cuentaId;
  }),
);
const want = Array.from({ length: N }, (_, i) => `AC-${String(i + 1).padStart(4, "0")}`);
const got = [...ids].sort();
console.assert(JSON.stringify(got) === JSON.stringify(want), "ids", got);
console.log(JSON.stringify(got) === JSON.stringify(want) ? `ok: ${N} ALTA paralelas, ids únicos` : "FALLA");
process.exitCode = JSON.stringify(got) === JSON.stringify(want) ? 0 : 1;
