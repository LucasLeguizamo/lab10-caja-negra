import { defineAgent } from "eve";

import { modelo, VENTANA } from "../../lib/modelo";

export default defineAgent({
  description:
    "Implementa en lib/service.ts el comportamiento que describe el informe del explorador, byte a byte, sin romper " +
    "lo existente, y no termina hasta que verificar pase (o tras 3 intentos fallidos, con el diagnóstico).",
  model: modelo(),
  modelContextWindowTokens: VENTANA,
  // medium: cada turno era ~2 min con high; las compuertas deterministas sostienen la calidad, no el razonamiento.
  reasoning: "medium",
});
