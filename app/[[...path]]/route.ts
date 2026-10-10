import { handle } from "../../lib/service";

// Una sola puerta: todas las rutas y métodos van a lib/service, que decide como el original.
async function route(req: Request) {
  const { pathname } = new URL(req.url);
  const res = handle(req.method, pathname, req.headers.get("authorization"), await req.text());
  const isText = typeof res.body === "string";
  return new Response(isText ? (res.body as string) : JSON.stringify(res.body), {
    status: res.status,
    headers: { "content-type": isText ? "text/plain; charset=utf-8" : "application/json; charset=utf-8" },
  });
}

export const dynamic = "force-dynamic";
export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE, route as HEAD, route as OPTIONS };
