import { defineTool } from "eve/tools";
import { z } from "zod";

import { environment } from "../sandbox";
import { sh, vigia } from "../lib/caja";
import { TTL_CANDADO_S } from "../lib/modelo";

export default defineTool({
  availableInSubagents: false,
  description:
    "Pasada del vigía: canario de los 20 ejemplos + puntos discriminantes (tools/watch.py) y detector de comandos " +
    "nuevos (tools/sondeo_comandos.py). Devuelve cambios, salida del canario y hallazgos de comandos. Si ya hay una " +
    "rama mision/* reclamada hace menos de 2 h, no sondea y devuelve misionAbierta (una misión a la vez). Las más " +
    "viejas son candados huérfanos (sesión muerta): se ignoran y se devuelven en huerfanas para anotarlas.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const s = await ctx.getSandbox(environment);
    // Fecha del commit de reclamo de cada rama mision/* (un sesión nunca dura más que el TTL: ver lib/modelo.ts).
    const r = await sh(
      s,
      "git fetch -q origin '+refs/heads/mision/*:refs/remotes/origin/mision/*' --prune && " +
        "git for-each-ref --format='%(refname:short) %(committerdate:unix) %(subject)' refs/remotes/origin/mision",
    );
    // Publicada (punta = commit de publicar): sigue bloqueando hasta que una persona mergee o borre la rama; si no,
    // el vigía volvería a ver la misma diferencia (main aún no tiene el arreglo) y relanzaría la misión.
    // Solo reclamada y más vieja que el TTL: sesión muerta, se ignora.
    const ahora = Date.now() / 1000;
    const ramas = r.stdout.trim().split("\n").filter(Boolean).map((l) => {
      const [nombre, t, ...asunto] = l.split(" ");
      return { nombre, publicada: asunto.join(" ").startsWith("feat(mision)"), edad: ahora - Number(t) };
    });
    const huerfana = (b: (typeof ramas)[number]) => !b.publicada && b.edad >= TTL_CANDADO_S;
    const vivas = ramas.filter((b) => !huerfana(b)).map((b) => b.nombre);
    const huerfanas = ramas.filter(huerfana).map((b) => b.nombre);
    if (vivas.length) return { misionAbierta: vivas };
    return { ...(await vigia(ctx)), huerfanas };
  },
});
