const os = require('os');
const path = require('path');
const fs = require('fs');
const createHttpError = require('http-errors');
const { logger } = require('@jobscale/logger');

class App {
  useHeader(req, res) {
    const headers = new Headers(req.headers);
    const protocol = req.socket.encrypted ? 'https' : 'http';
    const host = headers.get('host');
    const origin = headers.get('origin') || `${protocol}://${host}`;
    res.setHeader('ETag', 'false');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Server', 'acl-ingress-k8s');
    res.setHeader('X-Backend-Host', os.hostname());
  }

  usePublic(req, res) {
    const headers = new Headers(req.headers);
    const { url } = req;
    const protocol = req.socket.encrypted ? 'https' : 'http';
    const host = headers.get('host');
    const { pathname } = new URL(`${protocol}://${host}${url}`);
    const file = {
      path: path.join(process.cwd(), 'docs', pathname),
    };
    if (!fs.existsSync(file.path)) return false;
    const stats = fs.statSync(file.path);
    if (stats.isDirectory()) file.path += 'index.html';
    if (!fs.existsSync(file.path)) return false;
    const mime = filePath => {
      const ext = path.extname(filePath).toLowerCase();
      if (['.png', '.jpeg', '.webp', '.gif'].includes(ext)) return `image/${ext}`;
      if (['.jpg'].includes(ext)) return 'image/jpeg';
      if (['.ico'].includes(ext)) return 'image/x-ico';
      if (['.json'].includes(ext)) return 'application/json';
      if (['.pdf'].includes(ext)) return 'application/pdf';
      if (['.zip'].includes(ext)) return 'application/zip';
      if (['.xml'].includes(ext)) return 'application/xml';
      if (['.html', '.svg'].includes(ext)) return 'text/html';
      if (['.js'].includes(ext)) return 'text/javascript';
      if (['.css'].includes(ext)) return 'text/css';
      if (['.txt', '.md'].includes(ext)) return 'text/plain';
      return 'application/octet-stream';
    };
    const stream = fs.createReadStream(file.path);
    res.writeHead(200, { 'Content-Type': mime(file.path) });
    stream.pipe(res);
    return true;
  }

  useLogging(req, res) {
    const ts = new Date().toISOString();
    const progress = () => {
      const headers = new Headers(req.headers);
      const remoteIp = headers.get('X-Forwarded-For') || req.socket.remoteAddress;
      const { method, url } = req;
      const protocol = req.socket.encrypted ? 'https' : 'http';
      const host = headers.get('host');
      logger.info({
        ts,
        req: JSON.stringify({
          remoteIp, protocol, host, method, url,
        }),
        headers: JSON.stringify(Object.fromEntries(headers.entries())),
      });
    };
    progress();
    res.on('finish', () => {
      const { statusCode, statusMessage } = res;
      const headers = JSON.stringify(res.getHeaders());
      logger.info({
        ts, statusCode, statusMessage, headers,
      });
    });
  }

  router(req, res) {
    const headers = new Headers(req.headers);
    const method = req.method.toUpperCase();
    const { url } = req;
    const protocol = req.socket.encrypted ? 'https' : 'http';
    const host = headers.get('host');
    const { pathname, searchParams } = new URL(`${protocol}://${host}${url}`);
    const route = `${method} ${pathname}`;
    logger.debug({ route, searchParams });
    const data = Object.fromEntries(headers.entries());
    data['x-timestamp'] = new Date().toISOString();
    if (route === 'GET /') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(JSON.stringify(data, null, 2));
      return;
    }
    if (route === 'POST /') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
    this.notfoundHandler(req, res);
  }

  notfoundHandler(req, res) {
    if (req.method === 'GET') {
      const e = createHttpError(404);
      res.writeHead(e.status, { 'Content-Type': 'text/plain' });
      res.end(e.message);
      return;
    }
    const e = createHttpError(501);
    res.writeHead(e.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: e.message }));
  }

  errorHandler(e, req, res) {
    logger.error(e);
    if (!res) return;
    if (!e.status) e = createHttpError(500);
    res.writeHead(e.status, { 'Content-Type': 'text/plain' });
    res.end(e.message);
  }

  start() {
    return (req, res) => {
      try {
        this.useHeader(req, res);
        if (this.usePublic(req, res)) return;
        this.useLogging(req, res);
        this.router(req, res);
      } catch (e) {
        this.errorHandler(e, req, res);
      }
    };
  }
}

const app = new App();
app.app = app.start();
module.exports = app;
