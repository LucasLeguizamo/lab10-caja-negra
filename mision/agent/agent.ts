import { defineAgent } from "eve";

import { COMPACTACION_ROOT, LIMITES, modelo, VENTANA } from "./lib/modelo";

// Coordinador: decide si hay misión y a quién delegar. Mismo modelo que los subagentes (DeepSeek Flash vía
// OpenRouter); lo que sostiene la calidad no es el modelo sino las compuertas deterministas (verificar, candado).
export default defineAgent({
  model: modelo(),
  modelContextWindowTokens: VENTANA,
  reasoning: "medium",
  limits: LIMITES,
  compaction: COMPACTACION_ROOT,
  // Sin bash/read_file/write_file/web_*/agent por defecto: el coordinador solo usa sus tools de agent/tools/ y los
  // subagentes. Leer archivos le llenaba un contexto que se reenvía en cada pasada del día.
  defaultTools: false,
});
