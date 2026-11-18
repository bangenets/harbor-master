// Harbor Master — local dev server. Serves game/ at http://localhost:8080
// so the game can be played and screenshotted in desktop Chrome.
// Usage: node serve.ts [port]  (default 8080)

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');
const port = Number(process.argv[2] ?? 8080);
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

createServer((req, res) => {
  const raw = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const path = normalize(join(root, raw === '/' ? 'index.html' : raw));
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(port, () => console.log(`Harbor Master at http://localhost:${port}/`));
