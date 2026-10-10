// Red del sandbox. Los secretos nunca entran al sandbox: el firewall de Vercel Sandbox inyecta el header en la frontera.
//  - Original: solo mientras corre probe.py (sondear/vigia). Regla 3 del CLAUDE.md: nada de requests sin registrar.
//  - GitHub con credencial: solo mientras publicar hace push.

export const REPO_URL = "https://github.com/LucasLeguizamo/lab10-caja-negra.git";
export const REPO_DIR = "/workspace/repo";
export const ORIGINAL_HOST = "caja-negra-production-c64f.up.railway.app";
// probe.py manda "Bearer <CAJA_TOKEN>"; en el sandbox CAJA_TOKEN es este marcador y el firewall pone el real.
export const TOKEN_MARCADOR = "agente";

export type Apertura = "original" | "github";

const BASE = ["github.com", "codeload.github.com", "registry.npmjs.org", "objects.githubusercontent.com"];

type Regla = { transform: { headers: Record<string, string> }[] };
export type Politica = { allow: Record<string, Regla[]> };

export function politica(abrir: Apertura[] = []): Politica {
  const allow: Record<string, Regla[]> = Object.fromEntries(BASE.map((h) => [h, []]));
  if (abrir.includes("original")) {
    allow[ORIGINAL_HOST] = [{ transform: [{ headers: { authorization: `Bearer ${requerir("CAJA_TOKEN_AGENTE")}` } }] }];
  }
  if (abrir.includes("github")) {
    const basic = Buffer.from(`x-access-token:${requerir("GITHUB_TOKEN")}`).toString("base64");
    allow["github.com"] = [{ transform: [{ headers: { authorization: `Basic ${basic}` } }] }];
  }
  return { allow };
}

export function requerir(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`falta ${nombre} en el entorno del agente`);
  return v;
}
