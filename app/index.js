const os = require('os');
const path = require('path');
const fs = require('fs');
const createHttpError = require('http-errors');
const { logger } = require('@jobscale/logger');

const silent = () => undefined;

class App {
  useHeader(req, res) {
    const headers = new Headers(req.headers);
    const origin = headers.get('origin') || `${req.protocol}://${headers.get('host')}`;
    res.setHeader('ETag', 'false');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Server', 'acl-ingress-k8s');
    res.setHeader('X-Backend-Host', os.hostname());
  }

  usePublic(req, res) {
    const { protocol, url } = req;
    const { pathname } = new URL(`${protocol}://${url}`);
    const filePath = path.join(process.cwd(), 'docs', pathname);
    try {
      const buf = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(buf);
    } catch (e) {
      silent(e.message);
    }
  }

  useLogging(req, res) {
    const ts = new Date().toLocaleString();
    const progress = () => {
      const remoteIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const { protocol, method, url } = req;
      const reqHHeaders = JSON.stringify(req.headers);
      logger.info({
        ts, remoteIp, protocol, method, url, headers: reqHHeaders,
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
    const method = req.method.toLowerCase();
    const { protocol, url } = req;
    const { pathname, searchParams } = new URL(`${protocol}://${url}`);
    const route = `${method} ${pathname}`;
    silent({ route, searchParams });
    if (route === 'get /') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(Object.entries(req.headers).join('\n'));
      return;
    }
    if (route === 'post /') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(req.headers));
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

  start() {
    return (req, res) => {
      this.useHeader(req, res);
      this.usePublic(req, res);
      this.useLogging(req, res);
      this.router(req, res);
    };
  }
}

module.exports = {
  app: new App().start(),
};
