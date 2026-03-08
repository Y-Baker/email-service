const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { fetch } = require('undici');
const net = require('node:net');
const dns = require('node:dns').promises;

function isPrivateIPv4(ip) {
  const octets = ip.split('.').map((x) => parseInt(x, 10));
  if (octets.length !== 4 || octets.some(Number.isNaN)) return true;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
}

function isLocalHostname(hostname) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local');
}

function isHostnameAllowed(hostname, allowlist = []) {
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true;
  const host = hostname.toLowerCase();
  return allowlist.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

async function assertSafeRemoteUrl(url, allowlist = []) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid sheetUrl');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('sheetUrl must use http or https');
  }

  if (parsed.username || parsed.password) {
    throw new Error('sheetUrl must not include credentials');
  }

  const host = parsed.hostname;
  if (!host || isLocalHostname(host)) {
    throw new Error('sheetUrl host is not allowed');
  }
  if (!isHostnameAllowed(host, allowlist)) {
    throw new Error('sheetUrl host is not allowlisted');
  }

  const ipType = net.isIP(host);
  let addresses;
  if (ipType) {
    addresses = [{ address: host, family: ipType }];
  } else {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  }
  if (!addresses.length) {
    throw new Error('sheetUrl host resolution failed');
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      throw new Error('sheetUrl private IPv4 targets are blocked');
    }
    if (family === 6 && isPrivateIPv6(address)) {
      throw new Error('sheetUrl private IPv6 targets are blocked');
    }
  }
}

// Infer format from filename extension
function detectFormat(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.tsv')) return 'tsv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  return 'csv'; // default
}

function parseBuffer(buffer, format) {
  if (format === 'xlsx') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheet];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    return json;
  }
  // CSV/TSV
  const delimiter = format === 'tsv' ? '\t' : ',';
  const text = buffer.toString('utf8');
  const records = parse(text, { delimiter, relax_column_count: true });
  return records;
}

function sanitizeMatrix(matrix) {
  // Remove empty trailing rows
  return matrix.filter(row => Array.isArray(row) && row.some(cell => String(cell).trim().length));
}

function normalizeHeaders(rawHeaders) {
  return rawHeaders.map(h => String(h).trim());
}

function sliceRows(matrix) {
  if (!matrix.length) return { headers: [], rows: [] };
  const headers = normalizeHeaders(matrix[0]);
  const rows = matrix.slice(1).map(r => r.map(c => (c === null || c === undefined ? '' : String(c))));
  return { headers, rows };
}

async function parseSheetFromFile(file) {
  if (!file) throw new Error('file required');
  const format = detectFormat(file.originalname || '');
  const matrix = parseBuffer(file.buffer, format);
  const cleaned = sanitizeMatrix(matrix);
  return sliceRows(cleaned);
}

async function parseSheetFromUrl(url, options = {}) {
  if (!url) throw new Error('sheetUrl required');
  const allowlist = Array.isArray(options.allowlist) ? options.allowlist : [];
  await assertSafeRemoteUrl(url, allowlist);
  const lower = url.toLowerCase();
  const format = detectFormat(lower);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const resp = await fetch(url, { signal: controller.signal, redirect: 'error' })
    .finally(() => clearTimeout(timeout));
  if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const matrix = parseBuffer(buffer, format);
  const cleaned = sanitizeMatrix(matrix);
  return sliceRows(cleaned);
}

module.exports = { parseSheetFromFile, parseSheetFromUrl };
