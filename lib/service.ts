// Reemplazo de la caja negra. Todo comportamiento cita los ids de experimentos.jsonl.
// Estado: en Vercel varias instancias pueden atender el set, así que vive en Upstash Redis (KV_REST_API_*).
// Sin esas variables (local, tests) cae al Map en memoria de un solo proceso.
// "supuesto:" = no observado en el log; es el default del reemplazo (ver spec/arquitectura.md).

import { Redis } from "@upstash/redis";

export type Reply = { status: number; body: unknown; headers?: Record<string, string> };

type Op = { tipo: "DEPOSITO" | "TRANSFER"; monto: number; origen: string | null; destino: string; anulada: boolean };
type Store = { cuentas: Map<string, number>; ops: Map<string, Op>; nextAC: number; nextOP: number };

const newStore = (): Store => ({ cuentas: new Map(), ops: new Map(), nextAC: 1, nextOP: 1 });

// globalThis: `next dev` recarga módulos; el estado debe sobrevivir. Un solo token (el del equipo) => un solo Store.
const g = globalThis as unknown as { __caja?: { store: Store; xreq: number } };
g.__caja ??= { store: newStore(), xreq: 0 };
const S = g.__caja;

const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = kvUrl && kvToken ? new Redis({ url: kvUrl, token: kvToken }) : null;
// Prefijo por entorno: preview y production comparten la base de Upstash, no el estado.
const K = ((p) => ({ store: `${p}:store`, xreq: `${p}:xreq`, lock: `${p}:lock`, vuelo: `${p}:vuelo` }))(`caja:${process.env.VERCEL_ENV ?? "local"}`);

type Dump = { cuentas: [string, number][]; ops: [string, Op][]; nextAC: number; nextOP: number };
const load = (d: Dump | null): Store =>
  d ? { cuentas: new Map(d.cuentas), ops: new Map(d.ops), nextAC: d.nextAC, nextOP: d.nextOP } : newStore();
const dump = (st: Store): Dump => ({ ...st, cuentas: [...st.cuentas], ops: [...st.ops] });
const UNLOCK = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end return 0";

// ponytail: lock global (un token => un estado); leer-mutar-escribir el Store entero porque /__reset lo deja chico.
async function withStore<T>(fn: (st: Store) => T): Promise<T> {
  if (!redis) return fn(S.store);
  const id = crypto.randomUUID();
  for (let i = 0; !(await redis.set(K.lock, id, { nx: true, px: 5000 })); i++) {
    if (i >= 200) throw new Error("caja: lock ocupado");
    await new Promise((r) => setTimeout(r, 15));
  }
  try {
    const st = load(await redis.get<Dump>(K.store));
    const out = fn(st);
    await redis.set(K.store, dump(st));
    return out;
  } finally {
    await redis.eval(UNLOCK, [K.lock], [id]);
  }
}

// Caja de vuelo: cada request recibido y lo que respondimos, para reconstruir las corridas del set (tools/corrida.py).
// Ninguna credencial se guarda: "team" si es la nuestra; si no, solo su forma ("Bearer <otro>", "Basic <otro>",
// "Bearer " vacío). Basta para el replay: toda credencial inválida da el mismo E001 (ids 95-102).
// ponytail: lista acotada a 20k entradas (~100 tests x 12 pasos x muchas corridas); sin Redis no se graba.
// "Bearer abc" -> "Bearer <otro>", "Basic x" -> "Basic <otro>", "abc" -> "<otro>"; "Bearer " y "" quedan (no llevan secreto).
const forma = (a: string | null) =>
  a === null || /^\S*\s*$/.test(a) && /\s$|^$/.test(a) ? a : /^\S+\s+\S/.test(a) ? a.replace(/^(\S+\s+)[\s\S]*$/, "$1<otro>") : "<otro>";
export async function record(e: { method: string; path: string; auth: string | null; body: string; ua: string | null; ct: string | null; res: Reply }) {
  if (!redis) return;
  const team = process.env.TEAM_TOKEN && e.auth === `Bearer ${process.env.TEAM_TOKEN}`;
  const row = { ts: Date.now(), method: e.method, path: e.path, auth: team ? "team" : forma(e.auth), body: e.body,
    ua: e.ua, ct: e.ct, status: e.res.status, response: e.res.body };
  await redis.lpush(K.vuelo, JSON.stringify(row));
  await redis.ltrim(K.vuelo, 0, 19999);
}

const err = (status: number, error: string, mensaje: string, extra?: object): Reply => ({
  status,
  body: { error, mensaje, ...extra },
});
const E404 = () => err(404, "E404", "ruta desconocida"); // ids 29,35,44,45,69,72-75,77,89-93,103-106
const E001 = () => err(401, "E001", "no autorizado"); // ids 1,37,38,70,71,94-102

// Rutas existentes: método + ruta exactos, case-sensitive, sin normalizar barra final (ids 35,44,45,75,77,89-92).
const ROUTES = new Set(["GET /health", "POST /__reset", "POST /msg"]);

// Control (ids 4-23 ejemplos, 122-128): N = concatenación decimal de dígitos y posiciones A=1..Z=26 del payload en
// mayúsculas, el resto de caracteres no suma (ids 61,63,83: espacios ignorados). Control = 98 - (100*N mod 97).
// ids 123-128 refutan "(1-3N) mod 97": AC-0038 acepta 97 y rechaza 0; AC-0070 acepta 98 y rechaza 1;
// AC-0005 acepta 2 y rechaza 99 (rango 2..98).
export function control(payload: string): number {
  let h = 0;
  for (const ch of payload.toUpperCase()) {
    if (ch >= "0" && ch <= "9") h = (h * 10 + (ch.charCodeAt(0) - 48)) % 97;
    else if (ch >= "A" && ch <= "Z") {
      const v = ch.charCodeAt(0) - 64;
      h = (h * (v >= 10 ? 100 : 10) + v) % 97;
    }
  }
  return 98 - ((100 * h) % 97);
}

const ARIDAD: Record<string, number> = { PING: 0, ALTA: 1, CONSULTA: 1, DEPOSITO: 2, TRANSFER: 3, ANULA: 1 };
// Tope por operación de TRANSFER = 100000: 100000 pasa (ids 13,300-302), 100001 da E506 (id 303), 120000 también (id 12).
// Es por operación, no acumulado: 3 x 100000 seguidas pasan (ids 300-302).
const LIMITE_TRANSFER = 100000;

function lev(a: string, b: string): number {
  let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    for (let j = 1; j <= b.length; j++) c.push(Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    p = c;
  }
  return p[b.length];
}

const id4 = (p: string, n: number) => `${p}-${String(n).padStart(4, "0")}`;
// Monto: /^[1-9][0-9]{0,9}$/ (1 a 10 dígitos ASCII, sin ceros a la izquierda). Rechazan: 0, -5, -0, 00, 007, 0100, 100.5,
// 100,5, +100, " 100", "100 ", "100\t", 1e3, 0x10, 1_000, "١٠٠" (ids 162-182, 215-225, 311, 323) y 11+ dígitos:
// 9999999999 pasa (id 204), 10000000000 no (ids 205-210, 226). Mismo error en DEPOSITO y TRANSFER.
const parseMonto = (s: string): number | null => (/^[1-9][0-9]{0,9}$/.test(s) ? +s : null);
const E303 = () => err(400, "E303", "monto inválido");
const E401 = () => err(404, "E401", "cuenta inexistente"); // id 18
const E507 = () => err(422, "E507", "saldo insuficiente"); // id 19

// Cuerpo máximo: 6017 bytes pasan (ids 147,150), 8517, 11017 y 20017 dan 413 E101 (ids 429,148,149). supuesto: umbral
// exacto 8192 bytes (cualquier valor en (6017,8517) cuadra con el log), evaluado tras auth y antes de parsear JSON.
const MAX_BODY = 8192;

function msg(st: Store, raw: string): Reply {
  if (Buffer.byteLength(raw) > MAX_BODY) return err(413, "E101", "cuerpo demasiado grande");
  // Cuerpo: JSON inválido o vacío -> E100 (ids 33,42); sin m o m no string -> E102 (ids 40,41).
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return err(400, "E100", "json inválido");
  }
  // Array -> E102 (id 146); claves extra se ignoran (id 145). supuesto: string/número/null JSON -> E102 también.
  const m = data && typeof data === "object" && !Array.isArray(data) ? (data as { m?: unknown }).m : undefined;
  if (typeof m !== "string") return err(400, "E102", "falta m");

  const segs = m.split(";");
  // E103 sin ';' (id 64); E104 segmento vacío en cualquier posición (ids 54,65,66,87,112). m="" y m="   " -> E103 (ids 143,144).
  if (segs.length < 2) return err(400, "E103", "falta control");
  if (segs.some((s) => s === "")) return err(400, "E104", "segmento vacío");

  const cmd = segs[0].toUpperCase(); // insensible a mayúsculas, sin recortar (ids 59,60,63,85,88)

  // PING: exento de control (ids 49-62: 00,63,65,99,XX,100,064,6,-1 y espacios devuelven pong); su aridad se evalúa
  // antes (ids 67,68: PING;64;64 y PING;1;64 -> E302).
  if (cmd === "PING") {
    if (segs.length !== 2) return err(400, "E302", "aridad inválida");
    return { status: 200, body: { pong: true } };
  }

  // Control del resto: antes que comando desconocido (ids 79-82,86: PIN/PINGG/PONG/ALTAS/SALDO con control malo -> E202).
  // Forma: 1-2 dígitos exactos; 014, 0014, +14, " 14", "14 ", 111, 14.0, -83, XX -> E201 (ids 111,113-121).
  // Valor: se compara como string canónico (sin ceros a la izquierda): "02" con control 2 -> E202 (ids 152,153), y
  // "03" con control 3 -> E202 (id 360).
  const ctrl = segs[segs.length - 1];
  if (!/^\d{1,2}$/.test(ctrl)) return err(400, "E201", "control mal formado");
  if (ctrl !== String(control(segs.slice(0, -1).join(";")))) return err(400, "E202", "control inválido");

  const args = segs.slice(1, -1);
  if (!(cmd in ARIDAD)) {
    // ids 15,63,78,83,84,88,365-389: el mensaje lleva espacio final; si el nombre (en mayúsculas, sin recortar) está a
    // distancia de Levenshtein <= 2 de un comando conocido se añade "sugerencia" con ese comando. Distancia 2 sugiere
    // (ids 384 "CONSULTA  ", DEPOSTIO), distancia 3 no (SALDO, id 377); FOO, XYZ, SALDOS, TRANSFERENCIA: nada.
    // Empate a igual distancia: gana el primero en orden alfabético (ids 456 ANLUA, 471 ALNG -> ALTA). Probable:
    // también encaja con "ALTA se revisa primero"; el desempate no está aislado.
    const sug = Object.keys(ARIDAD)
      .map((c) => [lev(cmd, c), c] as const)
      .filter(([d]) => d <= 2)
      .sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1))[0]?.[1];
    return sug ? err(400, "E301", "comando desconocido ", { sugerencia: sug }) : err(400, "E301", "comando desconocido ");
  }
  if (args.length !== ARIDAD[cmd]) return err(400, "E302", "aridad inválida"); // ids 23 (ALTA); resto supuesto

  switch (cmd) {
    case "ALTA": {
      // ids 6,7,108,340-354: 201 {cuentaId}; AC consecutivo, solo en éxito (ids 5,355,360 E202 no consumen; 356-358 tampoco).
      // Nombre sin validar: duplicados, mayúsculas, espacios, unicode, "123" y "   " se aceptan (ids 340-354).
      const id = id4("AC", st.nextAC++);
      st.cuentas.set(id, 0);
      return { status: 201, body: { cuentaId: id } };
    }
    case "CONSULTA": {
      // id exacto y case-sensitive: ac-0001, AC-1, AC-00001, "AC-0001 ", 0001 -> E401 (ids 313-319, 331-332)
      const saldo = st.cuentas.get(args[0]);
      if (saldo === undefined) return E401(); // id 18
      return { status: 200, body: { cuenta_id: args[0], saldo } }; // ids 8,11 (clave cuenta_id, no cuentaId)
    }
    case "DEPOSITO": {
      // E303 (monto) antes que E401 (cuenta): ids 310-311. Sin tope: hasta 9999999999 pasa (ids 188-204).
      const monto = parseMonto(args[1]);
      if (monto === null) return E303();
      const saldo = st.cuentas.get(args[0]);
      if (saldo === undefined) return E401(); // ids 310,312-315
      st.cuentas.set(args[0], saldo + monto);
      const op = id4("OP", st.nextOP++); // un solo contador OP para DEPOSITO y TRANSFER (ids 9,10,13,21)
      st.ops.set(op, { tipo: "DEPOSITO", monto, origen: null, destino: args[0], anulada: false });
      return { status: 200, body: { status: "recieved", operacionId: op } }; // "recieved" (typo) ids 9,10,13,21
    }
    case "TRANSFER": {
      const [o, d] = args;
      // Orden: E303 (monto) -> E304 (origen == destino) -> E401 (cuenta) -> E506 (límite) -> E507 (saldo).
      // E303 antes que E304 (id 330) y antes que E401 (id 323); E304 antes que E506/E507 (ids 327-329: 100001 y 60 > saldo 50);
      // E401 antes que E506 (ids 324,326); E506 antes que E507 (id 227: 9999999999 con saldo 5000).
      // supuesto: E304 antes que E401 (origen == destino inexistente no se probó).
      const monto = parseMonto(args[2]);
      if (monto === null) return E303();
      if (o === d) return err(400, "E304", "origen y destino iguales");
      const so = st.cuentas.get(o);
      const sd = st.cuentas.get(d);
      if (so === undefined || sd === undefined) return E401(); // ids 320-322,331-332 (origen o destino)
      if (monto > LIMITE_TRANSFER) return err(422, "E506", "límite excedido"); // ids 12,227,303
      if (monto > so) return E507(); // ids 19,229,230,338; monto == saldo pasa (id 335)
      st.cuentas.set(o, so - monto);
      st.cuentas.set(d, sd + monto);
      const op = id4("OP", st.nextOP++);
      st.ops.set(op, { tipo: "TRANSFER", monto, origen: o, destino: d, anulada: false });
      return { status: 200, body: { status: "recieved", operacionId: op } };
    }
    default: {
      // ANULA. Id exacto: OP-9999, OP-0000, XX-1, op-0001, OP-1, OP-00001, AC-0001, "OP-0001 ", 0001 -> 404 E402 (ids 238-247).
      const op = st.ops.get(args[0]);
      if (!op) return err(404, "E402", "operación inexistente");
      if (op.anulada) return { status: 200, body: { ok: false, motivo: "ya anulada" } }; // ids 17,263,268,295: 200, no error HTTP
      // Nunca E507: el destino puede quedar negativo y responde ok:true (ids 283-290: AC-0002 en -500). TRANSFER: el origen
      // recupera el monto y el destino lo pierde (ids 260-262, 16/19); DEPOSITO: se resta (ids 265-266).
      st.cuentas.set(op.destino, (st.cuentas.get(op.destino) as number) - op.monto);
      if (op.origen !== null) st.cuentas.set(op.origen, (st.cuentas.get(op.origen) as number) + op.monto);
      op.anulada = true;
      return { status: 200, body: { ok: true, anulada: args[0] } }; // id 16
    }
  }
}

export async function handle(method: string, path: string, auth: string | null, raw: string): Promise<Reply> {
  // Ruta+método antes que auth, incluso con token inválido o ausente (ids 69,72-75,77,89-92,103-106).
  // HEAD /msg -> 404 sin cuerpo (id 93); la ruta no define HEAD, así que cae aquí y la capa HTTP lo vacía.
  if (!ROUTES.has(`${method} ${path}`)) return E404();

  // Auth: solo "Bearer <TEAM_TOKEN>" exacto; Basic, bearer minúscula, vacío, inválido y ausente -> E001 (ids 95-102).
  const token = process.env.TEAM_TOKEN;
  if (!token || auth !== `Bearer ${token}`) return E001();

  if (path === "/health") return { status: 200, body: { ok: true } }; // ids 2,27
  if (path === "/__reset") {
    // id 3,24: 200 {ok:true}; reinicia cuentas/ops/contadores pero NO X-Req (id 24: X-Req sigue en 21).
    await withStore((st) => Object.assign(st, newStore()));
    return { status: 200, body: { ok: true } };
  }
  // X-Req: cuenta cada POST /msg autenticado, con cualquier resultado (ids 31,33,40-42,46); no cuenta /health,
  // /__reset, 404 ni 401 (ids 27,29,35,37-39,44,45). Los headers no se comparan en el set; se replica por fidelidad.
  const xreq = String(redis ? await redis.incr(K.xreq) : ++S.xreq);
  const r = await withStore((st) => msg(st, raw));
  return { ...r, headers: { "X-Req": xreq } };
}
