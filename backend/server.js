const http = require('node:http');
const { handleApiRequest } = require('./apiHandler');

const PORT = process.env.PORT || 5000;

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api')) {
    await handleApiRequest(req, res);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Share A Plate API Server is active.', version: '2.0.0' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Share A Plate Backend] API Server listening on http://localhost:${PORT}`);
});

module.exports = server;
