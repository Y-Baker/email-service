// Simple in-memory idempotency (replace with Redis or DB)
const store = new Map();
const { idempotencyEnabled, idempotencyTtlMs } = require('../config');

function makeKey(payload) {
  return payload.idempotencyKey || `${payload.to.join(',')}|${payload.subject}|${payload.templateId || ''}|${payload.retries || 0}`;
}

function checkAndSet(payload, ttlMs = null) {
  if (!idempotencyEnabled) return true;

  ttlMs = ttlMs || idempotencyTtlMs;
  const key = makeKey(payload);
  const existing = store.get(key);
  const now = Date.now();
  if (existing && existing > now) {
    return false; // duplicate
  }
  store.set(key, now + ttlMs);
  return true;
}

module.exports = { checkAndSet };

