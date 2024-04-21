const http = require('http');
const { logger } = require('@jobscale/logger');
const { app, errorHandler } = require('./app');

const PORT = process.env.PORT || 3000;

const main = async () => {
  const server = http.createServer(app);
  server.on('error', errorHandler);
  const options = {
    host: '0.0.0.0',
    port: PORT,
  };
  server.listen(options, () => {
    logger.info(JSON.stringify({
      Server: 'Started',
      'Listen on': `http://127.0.0.1:${options.port}`,
    }, null, 2));
  });
  return app;
};

module.exports = {
  server: main(),
};
