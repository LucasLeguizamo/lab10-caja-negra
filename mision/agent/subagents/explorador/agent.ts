import { defineAgent } from "eve";

import { modelo, VENTANA } from "../../lib/modelo";

export default defineAgent({
  description:
    "Explora en el servicio original un comando nuevo o un cambio de comportamiento: aridad, control, errores, " +
    "precedencia, formato de respuesta y efecto en el estado. Registra todo vía sondear y actualiza spec/preguntas.md " +
    "y spec/especificacion.md citando ids. Devuelve un informe observado/inferido/desconocido.",
  model: modelo(),
  modelContextWindowTokens: VENTANA,
  reasoning: "high",
});
