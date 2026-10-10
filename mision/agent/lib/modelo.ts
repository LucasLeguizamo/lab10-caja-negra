// Modelo de los tres agentes: DeepSeek Flash vía OpenRouter (proveedor directo, no AI Gateway).
// Versión fija, no "~deepseek/deepseek-flash-latest": un alias que se mueve cambia el comportamiento a mitad del día.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: { "X-Title": "lab10-caja-negra-mision" },
});

export const MODELO_ID = process.env.MISION_MODELO ?? "deepseek/deepseek-v4.1-flash";

export const modelo = () => openrouter(MODELO_ID);

// Con proveedor directo eve no recibe costo por paso: maxTokenCostUsdPerSession no contaría nada.
// Topes por tokens del root; los subagentes reciben una parte de lo que le queda al root (docs agent-config).
// Precio v4.1-flash en OpenRouter: $0.30/M entrada, $1.20/M salida → tope ≈ $2.40 + $0.48 por sesión.
export const LIMITES = {
  maxInputTokensPerSession: 8_000_000,
  maxOutputTokensPerSession: 400_000,
  // Menor que el TTL del candado: una sesión muerta nunca deja la rama mision/* "viva" para el vigía.
  sessionTimeoutMs: 100 * 60 * 1_000,
};

// Un reclamo de más de 2 h es de una sesión que ya expiró (100 min): el vigía lo trata como huérfano.
export const TTL_CANDADO_S = 2 * 60 * 60;

// eve no tiene metadata de modelos fuera del AI Gateway: hay que declarar la ventana para la compactación.
// El modelo admite 1.048.576; se declara menos a propósito para compactar antes (más barato y menos degradación).
export const VENTANA = 200_000;
