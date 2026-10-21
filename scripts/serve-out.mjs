// Minimal static server for the exported site (`out/`), used by the e2e tests.
// Mirrors Firebase Hosting: /login -> login.html, unknown paths -> 404.html.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../out/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4173);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain" };

async function resolve(urlPath) {
  const p = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  for (const c of [p, `${p}.html`, join(p, "index.html")]) {
    try {
      const full = join(root, c);
      if (!full.startsWith(root)) continue;
      if ((await stat(full)).isFile()) return full;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(new URL(req.url, "http://x").pathname);
  const target = file ?? join(root, "404.html");
  try {
    const body = await readFile(target);
    res.writeHead(file ? 200 : 404, { "content-type": types[extname(target)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`serving out/ on http://127.0.0.1:${port}`));
