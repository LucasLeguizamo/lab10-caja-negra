import { defineWorkflowTool } from "eve/tools";
import { sleep } from "eve/tools/sleep";

// Plan Hobby: un cron diario. El coordinador duerme entre pasadas sin ocupar cómputo (pausa durable).
export default defineWorkflowTool({
  ...sleep(),
  availableInSubagents: false,
  description: "Espera durable entre pasadas del vigía. Usa exactamente los segundos de `proximaPasadaSegundos`.",
});
