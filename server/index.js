const http = require('node:http');
const crypto = require('node:crypto');
const { hashScan, normalizeFiles, summarize } = require('./scanner/analyzer');
const { runDockerScan } = require('./scanner/dockerScanner');
const { TtlCache } = require('./services/cache');
const { FixedWindowRateLimiter } = require('./services/rateLimiter');
const { renderReportHtml } = require('./services/reportRenderer');
const { vulnerabilityPatterns } = require('./data/vulnerabilityPatterns');

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS || 600_000); // 10 min — first scan compiles Anchor deps

const cache = new TtlCache(60 * 60 * 1000);
const limiter = new FixedWindowRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

function send(res, statusCode, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'access-control-allow-origin': process.env.CORS_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...headers,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body exceeds 2MB limit'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON request body'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

async function withTimeout(promise, ms) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(Object.assign(new Error('Scan timed out'), { statusCode: 504 })), ms);
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(timeout);
  }
}

async function handleScan(req, res) {
  const rate = limiter.check(clientIp(req));
  if (!rate.allowed) {
    send(res, 429, { error: 'Rate limit exceeded', reset_at: new Date(rate.resetAt).toISOString() });
    return;
  }

  const body = await readJson(req);
  console.log('\n================== SCAN REQUEST INPUT ==================');
  console.log(JSON.stringify({ ...body, files: body.files?.map(f => ({ path: f.path, content_length: f.content?.length })) }, null, 2));
  console.log('========================================================\n');

  const projectName = String(body.project_name || body.projectName || 'Untitled Solana Project').slice(0, 120);
  const files = normalizeFiles(body.files);

  // Cache bypassed intentionally to ensure fresh Docker scans every time
  // const cacheKey = hashScan(projectName, files);
  // const cached = cache.get(cacheKey);

  const result = await withTimeout(runDockerScan({
    projectName,
    files,
    startedAt: new Date(),
    scanId: crypto.randomUUID(),
  }), SCAN_TIMEOUT_MS);

  console.log('\n================= SCAN RESPONSE OUTPUT =================');
  console.log(JSON.stringify(result, null, 2));
  console.log('========================================================\n');

  // cache.set(cacheKey, result);
  send(res, 200, result, {
    'x-ratelimit-remaining': String(rate.remaining),
    'x-cache': 'MISS',
  });
}

async function handleReport(req, res) {
  const body = await readJson(req);
  const findings = Array.isArray(body.findings) ? body.findings : [];
  const summary = body.summary || summarize(findings);
  const html = renderReportHtml({
    projectName: String(body.project_name || body.projectName || body.metadata?.project_name || 'SSW Audit Report').slice(0, 120),
    companyName: String(body.company_name || body.companyName || '').slice(0, 120),
    findings,
    summary,
    metadata: body.metadata || {},
  });

  send(res, 200, html, {
    'content-disposition': 'inline; filename="ssw-audit-report.html"',
  });
}

async function router(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      send(res, 204, '');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/healthz') {
      send(res, 200, { status: 'ok', service: 'ssw-backend', time: new Date().toISOString() });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/vulnerabilities') {
      send(res, 200, { patterns: vulnerabilityPatterns, count: vulnerabilityPatterns.length });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/scan') {
      await handleScan(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/report') {
      await handleReport(req, res);
      return;
    }

    send(res, 404, { error: 'Not found' });
  } catch (error) {
    send(res, error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
}

if (require.main === module) {
  http.createServer(router).listen(PORT, () => {
    console.log(`SSW backend listening on http://localhost:${PORT}`);
  });
}

module.exports = { router };
