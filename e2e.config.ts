// Suite e2e del reemplazo con tester-army/e2e: solo tests de API (fetch + matchers), sin motor ni modelo.
// Requiere Node >= 24.8:  E2E_BASE_URL=http://localhost:3111 pnpm e2e
import type { E2EConfig } from "e2e";

export default {
  projectId: "lab10-caja-negra",
  // Sin engine: nada de navegador. La URL del reemplazo llega por E2E_BASE_URL (tests/caja.ts).
  targets: [{ name: "api", platform: "http" }],
  tests: "tests/**/*.e2e.ts",
  // Un solo proceso con estado en memoria y cada test hace /__reset: en paralelo se pisarían.
  workers: 1,
  // El evaluador no reintenta: un test que solo pasa al segundo intento es un fallo.
  retries: 0,
  // El evaluador da 5 s por paso; un test entero (una seq) tiene margen de sobra con 60 s.
  timeout: 60_000,
  output: ".e2e",
  reporters: ["list", "markdown"],
} satisfies E2EConfig;
