// Reemplazo de la caja negra. Todo comportamiento cita los ids de experimentos.jsonl.
// ponytail: estado en memoria de un solo proceso; el set le habla a un solo proceso (material/README.md).

export type Reply = { status: number; body: unknown };

const TEAM_TOKEN = process.env.TEAM_TOKEN;

export function handle(method: string, path: string, auth: string | null, raw: string): Reply {
  // id 1: sin token → 401 E001 (también en /health)
  if (!TEAM_TOKEN || auth !== `Bearer ${TEAM_TOKEN}`) {
    return { status: 401, body: { error: "E001", mensaje: "no autorizado" } };
  }
  if (method === "GET" && path === "/health") return { status: 200, body: { ok: true } }; // supuesto
  // supuesto: lo demás aún sin especificar
  return { status: 501, body: { error: "pendiente", method, path, raw } };
}
