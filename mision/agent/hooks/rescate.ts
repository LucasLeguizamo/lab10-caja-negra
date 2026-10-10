import { defineHook } from "eve/hooks";

import { rescatar } from "../lib/caja";

// Red de seguridad. En una sesión de schedule, cruzar un tope de tokens no pide permiso: la siguiente llamada al modelo
// falla con SESSION_TOKEN_LIMIT_REACHED y la sesión termina (session.failed terminal, docs agent-config.md "Runtime
// limits"); un turno fallido tampoco se reanuda, porque nadie le manda otro mensaje. Así se perdió la misión del 10/10
// a las 17:52. Aquí ya no hay modelo que llame a publicar: si quedó una misión reclamada sin publicar, se publica lo que
// haya como [SIN PARIDAD] (ver lib/caja.ts rescatar). Los hooks del root no se disparan por turnos de subagentes.
async function rescate(motivo: string, ctx: Parameters<typeof rescatar>[0]) {
  try {
    console.warn("rescate de misión", await rescatar(ctx, motivo));
  } catch (error) {
    console.error("rescate de misión falló", error);
  }
}

export default defineHook({
  events: {
    async "session.failed"(event, ctx) {
      await rescate(`session.failed: ${event.data.code ?? "?"} ${event.data.message ?? ""}`.trim(), ctx);
    },
    async "turn.failed"(event, ctx) {
      await rescate(`turn.failed: ${event.data.code ?? "?"} ${event.data.message ?? ""}`.trim(), ctx);
    },
  },
});
