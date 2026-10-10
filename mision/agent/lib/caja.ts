// Operaciones sobre el repo clonado en el sandbox. Las herramientas (tools/) solo validan entrada y llaman aquí.
import type { SandboxSession } from "eve/sandbox";

import { environment } from "../sandbox";
import { politica, REPO_DIR, TOKEN_MARCADOR, type Apertura } from "./red";

type Ctx = { getSandbox: (env: typeof environment) => Promise<Awaited<ReturnType<typeof environment.open>>> };

/** Comando en el repo del sandbox. No lanza: el que llama decide qué es fallo. */
export async function sh(sandbox: SandboxSession, command: string, env: Record<string, string> = {}) {
  return sandbox.run({ command, workingDirectory: REPO_DIR, env });
}

/** Corre `fn` con la red abierta para `abrir` y la cierra pase lo que pase. */
export async function conRed<T>(ctx: Ctx, abrir: Apertura[], fn: (s: SandboxSession) => Promise<T>): Promise<T> {
  // ponytail: ventana de red compartida; un bash del implementador corriendo justo ahora también la vería.
  // Mejora si hace falta: sandbox propio para el explorador en vez de defineParentSandbox.
  const sandbox = await ctx.getSandbox(environment);
  await sandbox.setNetworkPolicy(politica(abrir));
  try {
    return await fn(sandbox);
  } finally {
    await sandbox.setNetworkPolicy(politica());
  }
}

const ENV_PROBE = { CAJA_TOKEN: TOKEN_MARCADOR };
const q = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/** Una seq vía probe.py (reset + mensajes). Devuelve las filas nuevas del log. */
export async function seq(ctx: Ctx, nombre: string, hipotesis: string, mensajes: string[]) {
  return conRed(ctx, ["original"], async (s) => {
    const r = await sh(s, `python3 tools/probe.py seq -- ${[nombre, hipotesis, ...mensajes].map(q).join(" ")}`, ENV_PROBE);
    if (r.exitCode !== 0) throw new Error(r.stderr || r.stdout);
    return r.stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  });
}

export async function concluir(ctx: Ctx, id: number, texto: string) {
  const s = await ctx.getSandbox(environment);
  const r = await sh(s, `python3 tools/probe.py concluir ${id} ${q(texto)}`);
  if (r.exitCode !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}

/**
 * Vigía: canario + puntos discriminantes (watch.py) y detector de nombres (sondeo_comandos.py).
 * Un crash de Python también sale con 1: solo cuenta como "cambio" si el script llegó a imprimir su resumen.
 */
export async function vigia(ctx: Ctx) {
  return conRed(ctx, ["original"], async (s) => {
    const watch = await sh(s, "python3 tools/watch.py", ENV_PROBE);
    const sondeo = await sh(s, "python3 tools/sondeo_comandos.py", ENV_PROBE);
    const cayo = (r: { exitCode: number; stdout: string; stderr: string }, resumen: string) =>
      r.exitCode !== 0 && !`${r.stdout}${r.stderr}`.includes(resumen);
    if (cayo(watch, "vigía:") || cayo(sondeo, "sondeo:")) {
      throw new Error(`vigía caído (no es un cambio):\n${watch.stderr.slice(-1500)}\n${sondeo.stderr.slice(-1500)}`);
    }
    // ponytail: rate-limit detectado por texto; watch.py no expone el campo infra en sus DIFF.
    const infra = /infra|rate-limit/i.test(`${watch.stdout}${watch.stderr}${sondeo.stderr}`);
    return {
      cambios: watch.exitCode === 1 || sondeo.exitCode === 1,
      posibleRateLimit: infra,
      watch: watch.stdout.slice(-4000),
      comandosNuevos: sondeo.stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l)),
    };
  });
}

/**
 * Compuerta de paridad (determinista, la misma para implementador y publicar):
 *  1. regla 2: el reemplazo no puede hablar con el original ni con otro reemplazo;
 *  2. el log solo crece: las filas de origin/main siguen iguales (salvo `conclusion`), nadie reescribió evidencia;
 *  3. build limpio (sin .next viejo) + servidor de cero en :3111;
 *  4. replay.py DE origin/main (no el del sandbox: el implementador tiene bash) sobre todo el log.
 */
export async function verificar(ctx: Ctx) {
  const s = await ctx.getSandbox(environment);
  const regla2 = await sh(s, "grep -rnE 'railway\\.app|ORIGINAL_URL|fetch\\(|https?://' lib app proxy.ts server.mjs || true");
  if (regla2.stdout.trim()) return { ok: false, etapa: "regla2", detalle: regla2.stdout.slice(-3000) };

  const log = await sh(s, `git show origin/main:experimentos.jsonl > /tmp/log-main.jsonl && python3 -c '${SOLO_CRECE}'`);
  if (log.exitCode !== 0) return { ok: false, etapa: "log", detalle: (log.stderr || log.stdout).slice(-3000) };

  const build = await sh(s, "rm -rf .next && pnpm build > /tmp/build.log 2>&1; rc=$?; tail -40 /tmp/build.log; exit $rc");
  if (build.exitCode !== 0) return { ok: false, etapa: "build", detalle: build.stdout };

  const replay = await sh(
    s,
    [
      "mkdir -p .gate/tools && git show origin/main:tools/replay.py > .gate/tools/replay.py",
      "ln -sf ../experimentos.jsonl .gate/experimentos.jsonl && ln -sfn ../material .gate/material",
      "kill $(lsof -ti tcp:3111) 2>/dev/null; true",
      "(PORT=3111 TEAM_TOKEN=test-token node server.mjs > /tmp/srv.log 2>&1 & echo $! > /tmp/srv.pid)",
      "for i in $(seq 1 30); do curl -s localhost:3111/health >/dev/null && break; sleep 1; done",
      "python3 .gate/tools/replay.py http://localhost:3111 > /tmp/replay.log 2>&1; rc=$?",
      "kill $(cat /tmp/srv.pid); tail -60 /tmp/replay.log; exit $rc",
    ].join("; "),
  );
  return { ok: replay.exitCode === 0, etapa: "replay", detalle: replay.stdout };
}

// Filas de origin/main idénticas en el log actual (ignorando `conclusion`, que concluir sí puede añadir).
const SOLO_CRECE = [
  "import json,sys",
  "f=lambda p:[{k:v for k,v in json.loads(l).items() if k!=\"conclusion\"} for l in open(p) if l.strip()]",
  "a,b=f(\"/tmp/log-main.jsonl\"),f(\"experimentos.jsonl\")",
  "bad=[x[\"id\"] for x,y in zip(a,b) if x!=y]",
  "sys.exit(f\"log reescrito: ids {bad[:20]}\" if bad else (\"log recortado\" if len(b)<len(a) else 0))",
].join("; ");
