// Modelo de los tres agentes: DeepSeek Flash vía OpenRouter (proveedor directo, no AI Gateway).
// Versión fija, no "~deepseek/deepseek-flash-latest": un alias que se mueve cambia el comportamiento a mitad del día.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: { "X-Title": "lab10-caja-negra-mision" },
});

export const MODELO_ID = process.env.MISION_MODELO ?? "deepseek/deepseek-v4.1-flash";

export const modelo = () => openrouter(MODELO_ID);

// Con proveedor directo eve no recibe costo por paso: maxTokenCostUsdPerSession no contaría nada, así que se limita
// por tokens (docs agent-config.md, "Runtime limits"). Una sesión de schedule NO puede pedir más presupuesto: al cruzar
// el tope, la siguiente llamada al modelo falla con SESSION_TOKEN_LIMIT_REACHED y la sesión termina (session.failed
// terminal) con todos sus subagentes. Eso pasó el 10/10 a las 17:52 con 8M: la sesión diaria acumula todas las
// pasadas del vigía + la misión, y cada turno reenvía el contexto entero.
// Precio v4.1-flash en OpenRouter: $0.30/M entrada (menos con caché), $1.20/M salida → peor caso ≈ $18 + $2.4 al día.
// El tope real de gasto va en la key de OpenRouter.
export const LIMITES = {
  maxInputTokensPerSession: 60_000_000,
  maxOutputTokensPerSession: 2_000_000,
  // Hobby solo permite un cron diario: UNA sesión al día que duerme entre pasadas (09:15 → 19:15 local + margen).
  sessionTimeoutMs: 11 * 60 * 60 * 1_000,
};

// Topes propios de cada subagente. eve aplica el del hijo solo si es más estricto que su parte del presupuesto del
// root (agent-config.md). Así un hijo que se pasa falla SOLO él, y al root le queda presupuesto para publicar lo que
// haya ([SIN PARIDAD]) en vez de morir con todo. Suma por misión (26M) < tope del root: caben ~2 misiones al día.
// Medido el 10/10: el explorador tardó ~14 min (~30 turnos); 10M es ~4x lo que necesita leyendo por rangos.
export const LIMITES_SUB = {
  explorador: { maxInputTokensPerSession: 10_000_000, maxOutputTokensPerSession: 300_000 },
  tester: { maxInputTokensPerSession: 4_000_000, maxOutputTokensPerSession: 150_000 },
  implementador: { maxInputTokensPerSession: 12_000_000, maxOutputTokensPerSession: 300_000 },
} as const;

// Compactar antes: cada llamada reenvía todo el contexto, así que un contexto de 180k (0.9 × 200k) cuesta 180k por
// turno. Con 0.5/0.6 cada turno cuesta como mucho ~100-120k. El root compacta antes porque vive todo el día.
export const COMPACTACION_ROOT = { thresholdPercent: 0.5 };
export const COMPACTACION_SUB = { thresholdPercent: 0.6 };

// Un reclamo sin publicar de más de 2 h es huérfano: en la sesión diaria las pasadas y las misiones van en serie, así
// que solo puede quedar uno así si la sesión murió a mitad de misión.
export const TTL_CANDADO_S = 2 * 60 * 60;

// Hora local del reto: UTC-5. Última pasada a las 19:15: después, una misión no llega a revisarse antes de las 20:00.
const UTC_OFFSET_H = -5;
const CORTE_LOCAL = { h: 19, m: 15 };
// 20 min: detectar antes un cambio de versión. Cada pasada cuesta ~70 requests: ~30 pasadas/día << 8.000.
const ENTRE_PASADAS_S = 20 * 60;

/** Segundos hasta la próxima pasada del vigía, o null si ya no cabe otra hoy. */
export function proximaPasadaS(ahora = new Date()): number | null {
  const local = new Date(ahora.getTime() + UTC_OFFSET_H * 3_600_000);
  const corte = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), CORTE_LOCAL.h - UTC_OFFSET_H, CORTE_LOCAL.m);
  return ahora.getTime() + ENTRE_PASADAS_S * 1000 <= corte ? ENTRE_PASADAS_S : null;
}

// eve no tiene metadata de modelos fuera del AI Gateway: hay que declarar la ventana para la compactación.
// El modelo admite 1.048.576; se declara menos a propósito para compactar antes (más barato y menos degradación).
export const VENTANA = 200_000;
