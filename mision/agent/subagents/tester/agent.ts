import { defineAgent } from "eve";

import { COMPACTACION_SUB, LIMITES_SUB, modelo, VENTANA } from "../../lib/modelo";

export default defineAgent({
  description:
    "Especialista en tests e2e (tester-army/e2e). Convierte el informe del explorador en tests/<slug>.e2e.ts: un " +
    "test por regla observada, citando ids, comparando como el evaluador. Los corre, comprueba que fallan por la razón " +
    "esperada antes de implementar, y los fija.",
  model: modelo(),
  modelContextWindowTokens: VENTANA,
  // medium: cada turno era ~2 min con high; las compuertas deterministas sostienen la calidad, no el razonamiento.
  reasoning: "medium",
  limits: LIMITES_SUB.tester,
  compaction: COMPACTACION_SUB,
  // Solo las tools de su carpeta tools/: sin bash ni web_*.
  defaultTools: false,
});
