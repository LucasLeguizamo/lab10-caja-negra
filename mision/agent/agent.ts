import { defineAgent } from "eve";

import { LIMITES, modelo, VENTANA } from "./lib/modelo";

// Coordinador: decide si hay misión y a quién delegar. Mismo modelo que los subagentes (DeepSeek Flash vía
// OpenRouter); lo que sostiene la calidad no es el modelo sino las compuertas deterministas (verificar, candado).
export default defineAgent({
  model: modelo(),
  modelContextWindowTokens: VENTANA,
  reasoning: "medium",
  limits: LIMITES,
});
