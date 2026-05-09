const crypto = require('node:crypto');
const { tools } = require('./rules');

function normalizeFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw Object.assign(new Error('files must be a non-empty array'), { statusCode: 400 });
  }

  return files.map((file, index) => {
    const path = String(file.path || file.name || '').trim();
    const content = String(file.content ?? '');

    if (!path) {
      throw Object.assign(new Error(`files[${index}].path is required`), { statusCode: 400 });
    }

    if (path.includes('\0') || path.startsWith('/') || path.split(/[\\/]/).includes('..')) {
      throw Object.assign(new Error(`${path} is not a safe relative path`), { statusCode: 400 });
    }

    if (content.length > 512_000) {
      throw Object.assign(new Error(`${path} exceeds the 512KB per-file limit`), { statusCode: 413 });
    }

    return { path, content };
  });
}

function hashScan(projectName, files) {
  const h = crypto.createHash('sha256');
  h.update(projectName);
  for (const file of files.slice().sort((a, b) => a.path.localeCompare(b.path))) {
    h.update(file.path);
    h.update('\0');
    h.update(file.content);
    h.update('\0');
  }
  return h.digest('hex');
}

function summarize(findings) {
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0, info: 0, by_tool: {} };
  for (const tool of tools) summary.by_tool[tool] = 0;

  for (const finding of findings) {
    summary[finding.severity] += 1;
    summary.by_tool[finding.tool_source] = (summary.by_tool[finding.tool_source] ?? 0) + 1;
  }

  return summary;
}

module.exports = { hashScan, normalizeFiles, summarize };
