import { defineAgent } from "eve";

import { COMPACTACION_SUB, LIMITES_SUB, modelo, VENTANA } from "../../lib/modelo";

export default defineAgent({
  description:
    "Explora en el servicio original un comando nuevo o un cambio de comportamiento: aridad, control, errores, " +
    "precedencia, formato de respuesta y efecto en el estado. Registra todo vía sondear, devuelve un informe " +
    "observado/inferido/desconocido con ids y, cuando se le pide, escribe spec/mision-<slug>.md.",
  model: modelo(),
  modelContextWindowTokens: VENTANA,
  // medium: cada turno era ~2 min con high; las compuertas deterministas sostienen la calidad, no el razonamiento.
  reasoning: "medium",
  limits: LIMITES_SUB.explorador,
  compaction: COMPACTACION_SUB,
  // Solo las tools de su carpeta tools/: sin bash (no puede hablar con el original fuera de sondear) ni web_*.
  defaultTools: false,
});
