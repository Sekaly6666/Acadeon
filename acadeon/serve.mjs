import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, 'dist/public');
const PORT = process.env.PORT || 5173;
const API_TARGET = 'http://127.0.0.1:8080';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // 1. Proxy vers l'API si l'URL commence par /api
  if (urlPath.startsWith('/api')) {
    const proxyReq = http.request(
      `${API_TARGET}${req.url}`,
      {
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API Server indisponible', details: err.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // 2. Fichiers statiques du frontend
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback SPA vers index.html
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erreur de lecture du fichier frontend');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n  \x1b[36m\x1b[1m⚡ ACADÉON FRONTEND PRÊT\x1b[0m`);
  console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   http://localhost:${PORT}/`);
  console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mProxy:\x1b[0m   http://localhost:${PORT}/api -> ${API_TARGET}/api\n`);
});
