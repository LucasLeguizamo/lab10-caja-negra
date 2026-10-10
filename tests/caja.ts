// Cliente de los tests e2e: habla con el REEMPLAZO (nunca con el original) y compara como el evaluador.
import { expect } from "e2e";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3111";
// El token que acepta el servidor bajo prueba (TEAM_TOKEN). En local, el mismo que usa tools/replay.py.
const TOKEN = process.env.E2E_TOKEN ?? "test-token";
// El evaluador da 5 s por paso.
const PASO_MS = 5_000;

export type Respuesta = { status: number; texto: string };

export async function pedir(
  method: string,
  path: string,
  { body, auth = `Bearer ${TOKEN}` }: { body?: string; auth?: string | null } = {},
): Promise<Respuesta> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth !== null) headers.authorization = auth;
  const r = await fetch(new URL(path, BASE), { method, headers, body, signal: AbortSignal.timeout(PASO_MS) });
  return { status: r.status, texto: await r.text() };
}

export const reset = () => pedir("POST", "/__reset");
export const msg = (m: string) => pedir("POST", "/msg", { body: JSON.stringify({ m }) });

/**
 * Como el evaluador: mismo status y mismo cuerpo. Esperado objeto → JSON sin orden de claves y con tipos estrictos;
 * esperado string → texto exacto, carácter por carácter.
 */
export function igual(r: Respuesta, status: number, cuerpo: unknown) {
  expect(r.status).toBe(status);
  if (typeof cuerpo === "string") expect(r.texto).toBe(cuerpo);
  else expect(JSON.parse(r.texto)).toEqual(cuerpo); // Object.is en primitivos: true ≠ 1, "1" ≠ 1
}

/** Pasos de una seq desde /__reset: [mensaje, status, cuerpo esperado]. Falla en el primer paso distinto. */
export async function seq(pasos: readonly (readonly [string, number, unknown])[]) {
  igual(await reset(), 200, { ok: true });
  for (const [m, status, cuerpo] of pasos) igual(await msg(m), status, cuerpo);
}

/** Dígito de control (port de control() en lib/service.ts; ids 4-23, 122-128). Para escribir mensajes válidos. */
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

/** "CMD;a;b" → "CMD;a;b;<control>". */
export const firmar = (payload: string) => `${payload};${control(payload)}`;

export const err = (error: string, mensaje: string, extra?: object) => ({ error, mensaje, ...extra });
