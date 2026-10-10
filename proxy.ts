import { NextResponse, type NextRequest } from "next/server";

// En Vercel no hay server.mjs: esto cubre lo mismo. "//", "\" y /_next/* son 404 E404 sin auth, como el original
// (ids 29,35,44,45). Next redirigiría "//" con 308 y serviría /_next por su cuenta.
// ponytail: "\" puede llegar ya convertido en "/" por el parser de URL; se verifica contra el despliegue.
const NOT_FOUND = JSON.stringify({ error: "E404", mensaje: "ruta desconocida" });

export function proxy(req: NextRequest) {
  const path = new URL(req.url).pathname;
  if (/(\\|\/\/)/.test(path) || path === "/_next" || path.startsWith("/_next/")) {
    return new NextResponse(req.method === "HEAD" ? null : NOT_FOUND, {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return NextResponse.next();
}
