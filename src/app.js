const express = require('express');
const emailRoutes = require('./routes/emailRoutes');
const logger = require('./utils/logger');
const fs = require('fs');
const path = require("path");
const config = require('./config');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({
    message: 'API is running',
    timestamp: new Date(),
  }));

app.use('/email', emailRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error({ err }, 'Error handler');

  res.status(err.status || 500).json({
    error: config.env === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// 404 Handler
app.use((req, res) => {
  const imagePath = path.join(__dirname, '../', '404.jpg');

  fs.readFile(imagePath, (err, data) => {
    if (err) {
      res.status(500).send('Error loading 404 image.');
    } else {
      res.writeHead(404, {
        'Content-Type': 'image/jpeg',
        'Content-Length': data.length
      });
      res.end(data);
    }
  });
});

module.exports = app;
