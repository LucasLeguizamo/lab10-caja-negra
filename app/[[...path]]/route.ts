import { handle } from "../../lib/service";

// req.text() se come el BOM; el original no: un BOM inicial es JSON inválido -> E100 (id 606).
const body = (b: ArrayBuffer) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(b);

// Una sola puerta: todas las rutas y métodos van a lib/service, que decide como el original.
async function route(req: Request) {
  const { pathname } = new URL(req.url);
  const res = handle(req.method, pathname, req.headers.get("authorization"), body(await req.arrayBuffer()));
  const isText = typeof res.body === "string";
  // HEAD: sin cuerpo (log id 93)
  const out = req.method === "HEAD" ? null : isText ? (res.body as string) : JSON.stringify(res.body);
  return new Response(out, {
    status: res.status,
    headers: {
      "content-type": isText ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
      ...res.headers,
    },
  });
}

export const dynamic = "force-dynamic";
export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE, route as HEAD, route as OPTIONS };
