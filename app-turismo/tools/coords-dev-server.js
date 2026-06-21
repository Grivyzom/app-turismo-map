const http = require('http');
const fs = require('fs');
const path = require('path');

const COORDS_DIR = path.join(__dirname, '../coords');

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/coords/files
  if (req.method === 'GET' && req.url === '/api/coords/files') {
    try {
      const files = fs.readdirSync(COORDS_DIR).filter(f => f.endsWith('.json') || f.endsWith('.geojson'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/coords/:filename
  if (req.method === 'GET' && req.url.startsWith('/api/coords/')) {
    const filename = req.url.replace('/api/coords/', '');
    if (!filename.endsWith('.json') && !filename.endsWith('.geojson')) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid file type' })); return;
    }
    
    const filePath = path.join(COORDS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404); res.end(JSON.stringify({ error: 'File not found' })); return;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/coords/:filename
  if (req.method === 'POST' && req.url.startsWith('/api/coords/')) {
    const filename = req.url.replace('/api/coords/', '');
    if (!filename.endsWith('.json') && !filename.endsWith('.geojson')) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid file type' })); return;
    }

    const filePath = path.join(COORDS_DIR, filename);
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 3005;
server.listen(PORT, () => {
  console.log(`Pure Node Coords Dev Server running at http://localhost:${PORT}`);
});
