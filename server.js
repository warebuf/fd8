// Local static server for fd8.  node server.js  →  http://localhost:8000/
var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 8000;
var ROOT = __dirname;
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

http.createServer(function(req, res){
  var urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  var filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT + path.sep)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, function(err, data){
    if (err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, function(){ console.log('fd8 running at http://localhost:' + PORT + '/'); });
