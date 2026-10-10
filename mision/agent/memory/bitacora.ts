import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";

// Bitácora operativa compartida por todas las sesiones (vigía y misiones). Scope fijo: las sesiones de schedule corren
// como principal "app", y byPrincipal desactiva la memoria para principales runtime.
// La EVIDENCIA no va aquí: vive en experimentos.jsonl y spec/ (citables por id). Aquí solo lo operativo.
export default defineMemory({
  description:
    "Bitácora operativa del agente de la caja negra: misiones (comando, rama, PR, resultado), falsos positivos del " +
    "vigía y su causa, hipótesis descartadas que costaron requests, y el gasto del día. Nunca tokens ni datos del log.",
  namespace: "lab10-caja-negra",
  provider: fileMemory({ maxCharacters: 6_000 }),
  scope: "caja-negra",
});
