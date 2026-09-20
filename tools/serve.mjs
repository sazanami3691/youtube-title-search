import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"]
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const candidate = resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    return null;
  }
  return candidate;
}

const server = createServer(async (request, response) => {
  try {
    const path = safePath(request.url ?? "/");
    if (!path || !(await stat(path)).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": mimeTypes.get(extname(path).toLowerCase()) ?? "application/octet-stream"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`YouTube Title Search: http://127.0.0.1:${port}\n`);
});
