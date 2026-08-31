import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Servidor estatico simple para usar CantusDei sin depender del modo dev de Vite.
// En Windows, Vite dev puede intentar lanzar subprocesos internos y fallar con EPERM.
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "dist");
const port = 4711;
const host = "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(response, filePath) {
  const type = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  const requestedPath = decodeURIComponent(new URL(request.url || "/", `http://${host}`).pathname);
  const normalizedPath = normalize(requestedPath).replace(/^([/\\])+/, "");
  const filePath = resolve(join(distDir, normalizedPath || "index.html"));

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (existsSync(filePath) && !request.url?.endsWith("/")) {
    sendFile(response, filePath);
    return;
  }

  const fallback = join(distDir, "index.html");
  if (existsSync(fallback)) {
    sendFile(response, fallback);
    return;
  }

  response.writeHead(404);
  response.end("Ejecuta npm run build antes de servir CantusDei.");
});

server.listen(port, host, () => {
  console.log(`CantusDei frontend disponible en http://${host}:${port}`);
});
