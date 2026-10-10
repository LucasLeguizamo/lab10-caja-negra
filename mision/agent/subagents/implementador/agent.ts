import { defineAgent } from "eve";

import { COMPACTACION_SUB, LIMITES_SUB, modelo, VENTANA } from "../../lib/modelo";

export default defineAgent({
  description:
    "Implementa en lib/service.ts el comportamiento que describe el informe del explorador, byte a byte, sin romper " +
    "lo existente, y no termina hasta que verificar pase (o tras 3 intentos fallidos, con el diagnóstico).",
  model: modelo(),
  modelContextWindowTokens: VENTANA,
  // medium: cada turno era ~2 min con high; las compuertas deterministas sostienen la calidad, no el razonamiento.
  reasoning: "medium",
  limits: LIMITES_SUB.implementador,
  compaction: COMPACTACION_SUB,
  // Solo las tools de su carpeta tools/ (bash, read_file, write_file declarados ahí); sin web_*.
  defaultTools: false,
});
