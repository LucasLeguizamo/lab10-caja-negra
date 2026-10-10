// Servidor de entrada. Next 16 redirige con 308 las rutas con "//" o "\" (base-server.js: normalizeRepeatedSlashes),
// pero el original responde 404 E404 (coordinador, log: ruta que no existe). Esas rutas nunca llegan a Next:
// se contestan aquí con el mismo cuerpo que lib/service.ts da a una ruta desconocida. Todo lo demás va a Next.
// Uso: `node server.mjs` (producción, tras `next build`) o `node server.mjs --dev`.
import http from "node:http";
import next from "next";

const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname: "0.0.0.0", port });
const nextHandler = app.getRequestHandler();
await app.prepare();

const NOT_FOUND = JSON.stringify({ error: "E404", mensaje: "ruta desconocida" });

http
  .createServer((req, res) => {
    const path = (req.url ?? "").split("?", 1)[0];
    // "//", "\" y /_next/* (estáticos propios de Next) no son rutas del servicio: 404 sin auth (como todo método+ruta desconocido)
    if (/(\\|\/\/)/.test(path) || path === "/_next" || path.startsWith("/_next/")) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : NOT_FOUND);
      return;
    }
    nextHandler(req, res);
  })
  .listen(port, "0.0.0.0", () => console.log(`listo en :${port}`));
