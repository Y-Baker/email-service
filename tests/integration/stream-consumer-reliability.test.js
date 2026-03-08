const test = require('node:test');
const assert = require('node:assert/strict');

const { processPayloadEntry } = require('../../src/queue/streamConsumer');

function makePayload(overrides = {}) {
  return {
    id: 'msg-1',
    schemaVersion: '1.0',
    to: ['user@example.com'],
    subject: 'Welcome',
    text: 'Hello',
    retries: 0,
    ...overrides,
  };
}

function makeClient() {
  const calls = {
    xack: [],
    xdel: [],
    xadd: [],
  };

  return {
    calls,
    async xack(...args) {
      calls.xack.push(args);
    },
    async xdel(...args) {
      calls.xdel.push(args);
    },
    async xadd(...args) {
      calls.xadd.push(args);
    },
  };
}

function makeLogger() {
  return {
    warnCalls: [],
    infoCalls: [],
    errorCalls: [],
    warn(payload, msg) {
      this.warnCalls.push({ payload, msg });
    },
    info(payload, msg) {
      this.infoCalls.push({ payload, msg });
    },
    error(payload, msg) {
      this.errorCalls.push({ payload, msg });
    },
  };
}

test('stream consumer: valid schemaVersion 1.0 payload is processed', async () => {
  const client = makeClient();
  const logger = makeLogger();
  let sendCalls = 0;

  const result = await processPayloadEntry({
    payload: makePayload(),
    entryId: '1-0',
    client,
    deps: {
      logger,
      checkAndSet: () => true,
      buildMessage: (payload) => ({ Subject: payload.subject }),
      sendViaMailjet: async () => {
        sendCalls += 1;
        return { success: true };
      },
    },
  });

  assert.equal(result.status, 'sent');
  assert.equal(sendCalls, 1);
  assert.equal(client.calls.xack.length, 1);
  assert.equal(client.calls.xdel.length, 1);
  assert.equal(logger.warnCalls.length, 0);
});

test('stream consumer: unknown schemaVersion warns and still processes', async () => {
  const client = makeClient();
  const logger = makeLogger();

  const result = await processPayloadEntry({
    payload: makePayload({ schemaVersion: '2.4' }),
    entryId: '2-0',
    client,
    deps: {
      logger,
      checkAndSet: () => true,
      buildMessage: (payload) => ({ Subject: payload.subject }),
      sendViaMailjet: async () => ({ success: true }),
    },
  });

  assert.equal(result.status, 'sent');
  assert.equal(client.calls.xack.length, 1);
  assert.equal(client.calls.xdel.length, 1);
  assert.equal(logger.warnCalls.some((entry) => String(entry.msg).includes('unknown')), true);
});

test('stream consumer: missing schemaVersion warns and still processes', async () => {
  const client = makeClient();
  const logger = makeLogger();
  const payload = makePayload();
  delete payload.schemaVersion;

  const result = await processPayloadEntry({
    payload,
    entryId: '3-0',
    client,
    deps: {
      logger,
      checkAndSet: () => true,
      buildMessage: (input) => ({ Subject: input.subject }),
      sendViaMailjet: async () => ({ success: true }),
    },
  });

  assert.equal(result.status, 'sent');
  assert.equal(client.calls.xack.length, 1);
  assert.equal(client.calls.xdel.length, 1);
  assert.equal(logger.warnCalls.some((entry) => String(entry.msg).includes('missing schemaVersion')), true);
});

test('stream consumer: invalid payload is rejected and acknowledged', async () => {
  const client = makeClient();
  const logger = makeLogger();
  let sendCalls = 0;

  const result = await processPayloadEntry({
    payload: makePayload({ subject: undefined }),
    entryId: '4-0',
    client,
    deps: {
      logger,
      checkAndSet: () => true,
      sendViaMailjet: async () => {
        sendCalls += 1;
        return { success: true };
      },
    },
  });

  assert.equal(result.status, 'failed');
  assert.equal(sendCalls, 0);
  assert.equal(client.calls.xack.length, 1);
  assert.equal(client.calls.xdel.length, 1);
  assert.equal(logger.errorCalls.length >= 1, true);
});

test('stream consumer: failed send is requeued within max retries', async () => {
  const client = makeClient();
  const logger = makeLogger();

  const result = await processPayloadEntry({
    payload: makePayload({ retries: 0 }),
    entryId: '5-0',
    client,
    maxRetryAttempts: 1,
    deps: {
      logger,
      checkAndSet: () => true,
      buildMessage: (payload) => ({ Subject: payload.subject }),
      sendViaMailjet: async () => ({ success: false, error: 'provider down' }),
    },
  });

  assert.equal(result.status, 'retried');
  assert.equal(client.calls.xadd.length, 1);
  assert.equal(client.calls.xack.length, 1);
  assert.equal(client.calls.xdel.length, 1);

  const requeuedPayload = JSON.parse(client.calls.xadd[0][3]);
  assert.equal(requeuedPayload.retries, 1);
  assert.equal(typeof requeuedPayload.id, 'string');
  assert.notEqual(requeuedPayload.id, 'msg-1');
});

test('stream consumer: failed send stops requeue at max retries', async () => {
  const client = makeClient();
  const logger = makeLogger();

  const result = await processPayloadEntry({
    payload: makePayload({ retries: 1 }),
    entryId: '6-0',
    client,
    maxRetryAttempts: 1,
    deps: {
      logger,
      checkAndSet: () => true,
      buildMessage: (payload) => ({ Subject: payload.subject }),
      sendViaMailjet: async () => ({ success: false, error: 'provider down' }),
    },
  });

  assert.equal(result.status, 'max-retries-exceeded');
  assert.equal(client.calls.xadd.length, 0);
  assert.equal(client.calls.xack.length, 1);
  assert.equal(client.calls.xdel.length, 1);
});
