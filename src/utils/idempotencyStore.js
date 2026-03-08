// Simple in-memory idempotency (replace with Redis or DB)
const store = new Map();

function makeKey(payload) {
  return payload.idempotencyKey || `${payload.to.join(',')}|${payload.subject}|${payload.templateId || ''}|${payload.retries || 0}`;
}

function checkAndSet(payload, ttlMs = 5 * 60 * 1000) {
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

