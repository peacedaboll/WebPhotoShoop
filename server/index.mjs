import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAuth } from "./auth.mjs";
const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};
export function createServer(options = {}) {
  const auth = createAuth(options);
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost");
      if (await auth(req, res, url)) return;
      if (!["GET", "HEAD"].includes(req.method)) {
        res
          .writeHead(405, { Allow: "GET, HEAD" })
          .end("Метод не поддерживается");
        return;
      }
      if (url.pathname === "/api/health") {
        res
          .writeHead(200, { "Content-Type": mime[".json"] })
          .end(JSON.stringify({ status: "ok", version: "0.3.0" }));
        return;
      }
      if (url.pathname === "/api/capabilities") {
        res.writeHead(200, { "Content-Type": mime[".json"] }).end(
          JSON.stringify({
            maxPixels: 8000000,
            maxLayers: 12,
            formats: ["png", "jpeg", "webp"],
            storage: "browser-memory",
          }),
        );
        return;
      }
      const name = decodeURIComponent(url.pathname);
      if (name.includes("\\")) {
        res
          .writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
          .end("Доступ запрещён");
        return;
      }
      const file = path.resolve(
        root,
        "." + (name === "/" ? "/index.html" : name),
      );
      if (file !== root && !file.startsWith(root + path.sep)) {
        res
          .writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
          .end("Доступ запрещён");
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch {
      res
        .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Файл не найден. Выполните npm run build перед запуском сервера.");
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createServer();
  server.on("error", (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? "Порт занят. Укажите другой PORT."
        : "Не удалось запустить сервер.",
    );
    process.exitCode = 1;
  });
  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`WebPhotoShoop: http://localhost:${port}`);
    if (host === "0.0.0.0") {
      const addresses = Object.values(os.networkInterfaces())
        .flatMap((interfaces) => interfaces ?? [])
        .filter((address) => address.family === "IPv4" && !address.internal)
        .map((address) => address.address);
      for (const address of new Set(addresses)) {
        console.log(`В локальной сети: http://${address}:${port}`);
      }
    }
  });
}
