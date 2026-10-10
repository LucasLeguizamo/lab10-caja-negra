import { defineTool } from "eve/tools";
import { z } from "zod";

import { conRed, sh } from "../lib/caja";

// El candado entre sesiones es la rama remota mision/*. Se crea con un commit vacío propio: su fecha es la hora del
// reclamo (el vigía la usa para caducar candados huérfanos) y dos sesiones a la vez no pueden ganar las dos: el segundo
// push no es fast-forward y git lo rechaza.
export default defineTool({
  availableInSubagents: false,
  description:
    "Reclama la misión antes de explorar: crea la rama mision/<slug> en GitHub y la deja como rama de trabajo del " +
    "sandbox. Falla si ya existe (otra sesión la tiene). Llamar UNA vez, al empezar. Con base (una rama de " +
    "publicadas, la más nueva) la misión se apila sobre ese arreglo aún sin mergear y su PR va contra esa rama.",
  inputSchema: z.object({
    slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
    base: z.string().regex(/^mision\/[a-z0-9-]+$/).optional(),
  }),
  async execute({ slug, base }, ctx) {
    // Con hora: un reclamo huérfano del mismo slug no bloquea uno nuevo.
    const rama = `mision/${slug}-${new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-")}`;
    return conRed(ctx, ["github"], async (s) => {
      const existe = await sh(s, `git ls-remote --exit-code --heads origin ${rama}`);
      if (existe.exitCode === 0) throw new Error(`${rama} ya existe: otra misión la tiene`);
      const r = await sh(
        s,
        `git fetch -q origin ${base ?? "main"} && git checkout -B ${rama} origin/${base ?? "main"} && ` +
          `git -c user.name=mision-caja -c user.email=mision@caja.local ` +
          `commit --allow-empty -m "chore(mision): reclamo ${rama}" && git push origin ${rama} && ` +
          // publicar abre el PR contra esta base; .gate/ no se commitea (publicar solo añade RUTAS).
          `mkdir -p .gate && rm -f .gate/tests.sha && echo ${base ?? "main"} > .gate/base`,
      );
      if (r.exitCode !== 0) throw new Error(r.stderr);
      return { rama, base: base ?? "main" };
    });
  },
});
