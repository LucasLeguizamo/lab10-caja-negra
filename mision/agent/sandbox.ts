import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

import { politica, REPO_DIR, REPO_URL } from "./lib/red";

// Snapshot: repo clonado + dependencias. Cada sesión parte de main actual (git reset en la inicialización).
export const environment = VercelSandbox.environment({
  prepare: async (sandbox) => {
    const r = await sandbox.run({
      // tester-army/e2e exige Node >= 24.8: si la imagen trae uno anterior, se instala el último 24.
      command:
        `node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=8)?0:1)' ` +
        `|| (sudo npm i -g n && sudo n 24) && ` +
        `git clone ${REPO_URL} ${REPO_DIR} && cd ${REPO_DIR} && corepack enable && pnpm install --frozen-lockfile`,
    });
    if (r.exitCode !== 0) throw new Error(r.stderr);
  },
});

export default defineSandbox(async () => {
  // Base: sin el original y sin credenciales. Solo sondear/vigia/publicar abren lo suyo y lo cierran (lib/red.ts).
  const sandbox = await environment.open({ networkPolicy: politica(), resources: { vcpus: 4 } });
  const r = await sandbox.run({
    command: "git fetch origin main && git reset --hard origin/main && pnpm install --frozen-lockfile",
    workingDirectory: REPO_DIR,
  });
  if (r.exitCode !== 0) throw new Error(r.stderr);
  return sandbox;
});
