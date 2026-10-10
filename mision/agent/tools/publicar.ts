import { defineTool } from "eve/tools";
import { z } from "zod";

import { abrirPr, verificar } from "../lib/caja";

export default defineTool({
  availableInSubagents: false,
  description:
    "Cierra la misión: corre la compuerta de paridad, commitea lib/ spec/ tests/ openapi.yaml docs/ experimentos.jsonl en la rama " +
    "reclamada, hace push y abre un PR en borrador contra main. Sin paridad, el título lleva [SIN PARIDAD] y el cuerpo " +
    "el fallo: la evidencia nunca se pierde y una persona decide. No despliega ni mergea. Si la misión se reclamó " +
    "apilada, el PR va contra la rama base (solo muestra el arreglo nuevo). Si devuelve pendiente, la compuerta sigue " +
    "corriendo: vuelve a llamar con el mismo título y cuerpo.",
  inputSchema: z.object({
    titulo: z.string().min(10).max(72),
    cuerpo: z.string().min(50).describe("qué comando, qué se observó (ids), qué se infirió, qué queda abierto"),
  }),
  async execute({ titulo, cuerpo }, ctx) {
    const gate = await verificar(ctx);
    // Compuerta aún corriendo: no se publica nada todavía; la próxima llamada recoge el resultado.
    if ("pendiente" in gate) return gate;
    const titular = gate.ok ? titulo : `[SIN PARIDAD] ${titulo}`;
    const texto = `${cuerpo}\n\n## Compuerta (${gate.etapa}: ${gate.ok ? "pasa" : "NO pasa"})\n\n\`\`\`\n${gate.detalle.slice(-3000)}\n\`\`\``;
    return { paridad: gate.ok, ...(await abrirPr(ctx, titular, texto)) };
  },
});
