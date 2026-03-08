const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSheetFromUrl } = require('../../src/utils/sheetParser');

test('sheet URL security: rejects non-http protocols', async () => {
  await assert.rejects(
    () => parseSheetFromUrl('ftp://example.com/participants.csv', { allowlist: ['example.com'] }),
    /sheetUrl must use http or https/
  );
});

test('sheet URL security: blocks localhost targets', async () => {
  await assert.rejects(
    () => parseSheetFromUrl('http://localhost/participants.csv', { allowlist: ['localhost'] }),
    /sheetUrl host is not allowed/
  );
});

test('sheet URL security: blocks private IPv4 targets', async () => {
  await assert.rejects(
    () => parseSheetFromUrl('http://127.0.0.1/participants.csv', { allowlist: ['127.0.0.1'] }),
    /sheetUrl private IPv4 targets are blocked/
  );
});

test('sheet URL security: rejects non-allowlisted hosts', async () => {
  await assert.rejects(
    () => parseSheetFromUrl('https://example.com/participants.csv', { allowlist: ['docs.example.com'] }),
    /sheetUrl host is not allowlisted/
  );
});
