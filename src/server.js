const app = require('./app');
const { port } = require('./config');
const { startConsumer } = require('./queue/streamConsumer');
const logger = require('./utils/logger');

app.listen(port, () => {
  logger.info({ port }, 'Email service listening');
});

startConsumer();
