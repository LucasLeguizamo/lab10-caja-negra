import { defineTool } from "eve/tools";
import { z } from "zod";

import { conRed, sh, verificar } from "../lib/caja";
import { requerir } from "../lib/red";

const REPO = "LucasLeguizamo/lab10-caja-negra";
// Solo esto puede cambiar una misión. Ni tools/ (la compuerta usa el replay.py de main, y no debe poder cambiarse
// desde la misión), ni .env, material/ o configuración de despliegue.
const RUTAS = "lib spec tests experimentos.jsonl";

export default defineTool({
  availableInSubagents: false,
  description:
    "Cierra la misión: corre la compuerta de paridad, commitea lib/ spec/ tests/ experimentos.jsonl en la rama " +
    "reclamada, hace push y abre un PR en borrador contra main. Sin paridad, el título lleva [SIN PARIDAD] y el cuerpo " +
    "el fallo: la evidencia nunca se pierde y una persona decide. No despliega ni mergea.",
  inputSchema: z.object({
    titulo: z.string().min(10).max(72),
    cuerpo: z.string().min(50).describe("qué comando, qué se observó (ids), qué se infirió, qué queda abierto"),
  }),
  async execute({ titulo, cuerpo }, ctx) {
    const gate = await verificar(ctx);
    const titular = gate.ok ? titulo : `[SIN PARIDAD] ${titulo}`;
    const texto = `${cuerpo}\n\n## Compuerta (${gate.etapa}: ${gate.ok ? "pasa" : "NO pasa"})\n\n\`\`\`\n${gate.detalle.slice(-3000)}\n\`\`\``;

    const rama = await conRed(ctx, ["github"], async (s) => {
      const cur = (await sh(s, "git rev-parse --abbrev-ref HEAD")).stdout.trim();
      if (!cur.startsWith("mision/")) throw new Error(`rama ${cur}: falta reclamar la misión`);
      const r = await sh(
        s,
        `git add ${RUTAS} && git -c user.name=mision-caja -c user.email=mision@caja.local commit --allow-empty -m "$MSG" && git push origin ${cur}`,
        { MSG: `feat(mision): ${titular}` },
      );
      if (r.exitCode !== 0) throw new Error(r.stderr || r.stdout);
      return cur;
    });

    const res = await fetch(`https://api.github.com/repos/${REPO}/pulls`, {
      method: "POST",
      headers: { authorization: `Bearer ${requerir("GITHUB_TOKEN")}`, accept: "application/vnd.github+json" },
      body: JSON.stringify({ title: titular, head: rama, base: "main", draft: true, body: texto }),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    const pr = (await res.json()) as { html_url: string };
    return { paridad: gate.ok, rama, pr: pr.html_url };
  },
});
