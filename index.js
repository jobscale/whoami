const http = require('http');
const { logger } = require('@jobscale/logger');
const { app } = require('./app');

const main = async () => {
  const server = http.createServer(app);
  const options = {
    host: '0.0.0.0',
    port: process.env.PORT || 3000,
  };
  server.listen(options, () => {
    logger.info(JSON.stringify({
      Server: 'Started',
      'Listen on': `http://127.0.0.1:${options.port}`,
    }, null, 2));
  });
};

module.exports = {
  server: main(),
};
