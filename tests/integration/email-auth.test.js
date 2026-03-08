const test = require('node:test');
const assert = require('node:assert/strict');

process.env.EMAIL_SERVICE_AUTH_TOKEN = process.env.EMAIL_SERVICE_AUTH_TOKEN || 'integration-email-token';
process.env.NODE_ENV = 'test';

const app = require('../../src/app');

function createServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function getBaseUrl(server) {
  const addr = server.address();
  return `http://127.0.0.1:${addr.port}`;
}

test('email ingress auth: missing token is rejected', async () => {
  const server = await createServer();
  try {
    const response = await fetch(`${getBaseUrl(server)}/email/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const payload = await response.json();
    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Missing service authentication token');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('email ingress auth: invalid token is rejected', async () => {
  const server = await createServer();
  try {
    const response = await fetch(`${getBaseUrl(server)}/email/send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': 'wrong-token',
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json();
    assert.equal(response.status, 403);
    assert.equal(payload.error, 'Invalid service authentication token');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('email ingress auth: valid token reaches endpoint validation', async () => {
  const server = await createServer();
  try {
    const response = await fetch(`${getBaseUrl(server)}/email/send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': process.env.EMAIL_SERVICE_AUTH_TOKEN,
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error, /Invalid email payload/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
