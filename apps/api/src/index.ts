import { serve } from "bun";

const server = serve({
  port: 3001,
  fetch(req) {
    if (new URL(req.url).pathname === "/healthz") {
      return Response.json({ status: "ok" });
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`api listening on ${server.port}`);
