import { defineTool } from "eve/tools";
import { z } from "zod";

import { environment } from "../sandbox";
import { sh, vigia } from "../lib/caja";
import { proximaPasadaS, TTL_CANDADO_S } from "../lib/modelo";

export default defineTool({
  availableInSubagents: false,
  description:
    "Pasada del vigía: canario de los 20 ejemplos + puntos discriminantes (tools/watch.py) y detector de comandos " +
    "nuevos (tools/sondeo_comandos.py). Devuelve cambios, salida del canario y hallazgos de comandos. Si hay una " +
    "rama mision/* reclamada SIN publicar de menos de 2 h, no sondea y devuelve misionAbierta (una exploración a la " +
    "vez: comparten token). Las publicadas (PR abierto) no bloquean: van en publicadas, la más nueva última, para " +
    "decidir si la diferencia ya está cubierta o hace falta la siguiente misión apilada encima. Los reclamos sin " +
    "publicar más viejos son huérfanos (sesión muerta): se ignoran y van en huerfanas.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const s = await ctx.getSandbox(environment);
    // Fecha del commit de reclamo de cada rama mision/* (un sesión nunca dura más que el TTL: ver lib/modelo.ts).
    const r = await sh(
      s,
      "git fetch -q origin main '+refs/heads/mision/*:refs/remotes/origin/mision/*' --prune && " +
        // Las ya mergeadas en main no cuentan: su arreglo ya está, y apilar encima no tendría sentido.
        "git for-each-ref --no-merged origin/main --format='%(refname:short) %(committerdate:unix) %(subject)' refs/remotes/origin/mision",
    );
    // Publicada (punta = commit de publicar): ya no bloquea. watch.py la seguirá viendo como diferencia (main no tiene
    // el arreglo), así que se devuelve su asunto y el coordinador decide si lo que queda ya está cubierto o es otra
    // misión, que se apila sobre la más nueva. Reclamada sin publicar: exploración en curso, bloquea (mismo token).
    // Reclamada sin publicar y más vieja que el TTL: sesión muerta, se ignora.
    const ahora = Date.now() / 1000;
    const ramas = r.stdout.trim().split("\n").filter(Boolean).map((l) => {
      const [nombre, t, ...asunto] = l.split(" ");
      const a = asunto.join(" ");
      return { nombre: nombre.replace(/^origin\//, ""), asunto: a, publicada: a.startsWith("feat(mision)"), edad: ahora - Number(t) };
    }).sort((a, b) => b.edad - a.edad);
    const huerfana = (b: (typeof ramas)[number]) => !b.publicada && b.edad >= TTL_CANDADO_S;
    const enCurso = ramas.filter((b) => !b.publicada && !huerfana(b)).map((b) => b.nombre);
    const huerfanas = ramas.filter(huerfana).map((b) => b.nombre);
    const publicadas = ramas.filter((b) => b.publicada).map(({ nombre, asunto }) => ({ rama: nombre, asunto }));
    const proximaPasadaSegundos = proximaPasadaS();
    if (enCurso.length) return { misionAbierta: enCurso, publicadas, proximaPasadaSegundos };
    return { ...(await vigia(ctx)), publicadas, huerfanas, proximaPasadaSegundos };
  },
});
