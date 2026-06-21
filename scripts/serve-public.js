"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8"
};

function safeJoin(root, requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  return path.normalize(path.join(root, pathname));
}

function resolveFile(publicDir, requestUrl) {
  let file = safeJoin(publicDir, requestUrl === "/" ? "/index.html" : requestUrl);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) && !path.extname(file)) file = path.join(file, "index.html");
  return file;
}

function servePublic(options) {
  const publicDir = options.publicDir || path.join(options.root || process.cwd(), "public");
  const host = options.host || "127.0.0.1";
  const port = Number(options.port || 1313);

  const server = http.createServer((req, res) => {
    const file = resolveFile(publicDir, req.url || "/");
    if (!file.startsWith(publicDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const type = MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    fs.createReadStream(file).pipe(res);
  });

  server.listen(port, host, () => {
    console.log(`Serving: ${publicDir}`);
    console.log(`URL: http://${host}:${port}/`);
  });

  return server;
}

module.exports = {
  servePublic,
  resolveFile
};

if (require.main === module) {
  servePublic({
    publicDir: path.resolve(process.cwd(), process.argv[2] || "public"),
    host: process.env.HOST || "127.0.0.1",
    port: process.env.PORT || "1313"
  });
}
