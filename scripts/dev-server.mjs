// 로컬 확인용 서버. node scripts/dev-server.mjs → http://localhost:4190
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import handler from '../api/ask.js';

const PORT = Number(process.env.PORT || 4190);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.md': 'text/markdown; charset=utf-8' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/ask') return handler(req, res);
  const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'index.html';
  const file = path.join('dist', rel.endsWith('/') ? `${rel}index.html` : rel);
  if (!file.startsWith('dist')) { res.statusCode = 403; return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('content-security-policy', CSP);
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
