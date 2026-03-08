const config = require('../config');

function getHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function requireServiceAuth(req, res, next) {
  if (!config.serviceAuthToken) {
    return res.status(503).json({ error: 'Service authentication is not configured' });
  }

  const headerValue = getHeaderValue(req.headers['x-service-token']);
  if (typeof headerValue !== 'string' || !headerValue.trim()) {
    return res.status(401).json({ error: 'Missing service authentication token' });
  }

  if (headerValue.trim() !== config.serviceAuthToken) {
    return res.status(403).json({ error: 'Invalid service authentication token' });
  }

  return next();
}

module.exports = { requireServiceAuth };
