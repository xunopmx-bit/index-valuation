const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'site');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json; charset=utf-8', '.css': 'text/css' };
http.createServer((req, res) => {
  let p = req.url === '/' ? '/index.html' : req.url;
  let f = path.join(root, p);
  if (f.includes('..')) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'text/plain' });
    res.end(d);
  });
}).listen(8787, () => console.log('server on 8787'));
