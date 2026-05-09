const crypto = require('node:crypto');

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function stableId(prefix, parts) {
  return `${prefix}-${crypto.createHash('sha1').update(parts.filter(Boolean).join(':')).digest('hex').slice(0, 8)}`;
}

function parseJson(value) {
  if (!value || !String(value).trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeSeverity(value, fallback = 'info') {
  const sev = String(value || fallback).toLowerCase();
  if (['critical', 'high', 'medium', 'low', 'info'].includes(sev)) return sev;
  if (sev === 'warning' || sev === 'warn') return 'medium';
  if (sev === 'error' || sev === 'deny') return 'high';
  if (sev === 'note' || sev === 'help') return 'info';
  return fallback;
}

function finding({ id, tool, severity, title, description, file, line, remediation }) {
  return {
    id,
    tool_source: tool,
    severity: normalizeSeverity(severity),
    title: title || 'Security finding',
    description: description || 'The scanner reported a security-relevant issue.',
    file: file || 'unknown',
    line: line ? Number(line) : undefined,
    remediation: remediation || 'Review the scanner output and apply the recommended fix.',
    location: line ? `${file || 'unknown'}:${line}` : (file || 'unknown'),
  };
}

function parseCargoAudit(stdout, stderr = '') {
  const data = parseJson(stdout);
  const vulnerabilities = data?.vulnerabilities?.list || data?.vulnerabilities?.found || [];
  return vulnerabilities.map((vuln) => finding({
    id: vuln.advisory?.id || stableId('AUD', [vuln.package?.name, vuln.advisory?.title]),
    tool: 'cargo-audit',
    severity: vuln.advisory?.cvss >= 9 ? 'critical' : vuln.advisory?.cvss >= 7 ? 'high' : 'medium',
    title: vuln.advisory?.title || `Vulnerable dependency: ${vuln.package?.name || 'unknown'}`,
    description: vuln.advisory?.description || stderr,
    file: 'Cargo.lock',
    remediation: vuln.versions?.patched?.length
      ? `Upgrade to ${vuln.package?.name} ${vuln.versions.patched.join(' or ')}.`
      : 'Upgrade the affected dependency to a patched version.',
  }));
}

function parseClippy(stdout, stderr = '') {
  const lines = `${stdout}\n${stderr}`.split(/\r?\n/).map(parseJson).filter(Boolean);
  return lines
    .filter((msg) => msg.reason === 'compiler-message' && msg.message)
    .filter((msg) => ['warning', 'error'].includes(msg.message.level))
    .map((msg) => {
      const span = msg.message.spans?.find((item) => item.is_primary) || msg.message.spans?.[0] || {};
      return finding({
        id: stableId('CLY', [msg.message.code?.code, span.file_name, span.line_start, msg.message.message]),
        tool: 'clippy',
        severity: normalizeSeverity(msg.message.level, 'medium'),
        title: msg.message.message,
        description: msg.message.rendered || msg.message.message,
        file: span.file_name,
        line: span.line_start,
        remediation: msg.message.children?.find((child) => child.level === 'help')?.message || 'Address the Clippy diagnostic.',
      });
    });
}

function parseCargoGeiger(stdout, stderr = '') {
  const text = `${stdout}\n${stderr}`;
  const lines = text.split(/\r?\n/);
  const hasNonZeroUnsafeCount = lines.some((line) => {
    const matches = [...line.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
    return matches.some((match) => Number(match[1]) > 0);
  });

  if (!hasNonZeroUnsafeCount) return [];

  return [finding({
    id: stableId('GEI', [text.slice(0, 200)]),
    tool: 'cargo-geiger',
    severity: 'high',
    title: 'Unsafe Rust usage detected',
    description: text.trim().slice(0, 1200) || 'cargo-geiger detected unsafe Rust usage.',
    file: 'Cargo.toml',
    remediation: 'Review every unsafe block and remove it or document invariants with tests.',
  })];
}

// Parses solana_fender CLI output.
// The tool emits either JSON ({ issues: [...] } or an array of findings)
// or plain-text lines like: "[HIGH] Missing owner check at src/lib.rs:12"
function parseSolanaFender(stdout, stderr = '') {
  if (!stdout && !stderr) return [];

  // Try JSON first
  const data = parseJson(stdout);
  if (data) {
    const issues = data.issues || data.findings || data.vulnerabilities || (Array.isArray(data) ? data : []);
    if (Array.isArray(issues) && issues.length > 0) {
      return issues.map((issue) => {
        const location = issue.location || issue.sourceLocation || issue.source || {};
        const file = location.file || issue.file || issue.filename || 'unknown';
        const line = location.line || issue.line;
        return finding({
          id: issue.id || stableId('SWC', [issue.title || issue.check, file, line]),
          tool: 'solana-fender',
          severity: issue.severity || issue.impact || issue.level || 'medium',
          title: issue.title || issue.name || issue.check || 'Security finding',
          description: issue.description || issue.message || issue.details || stderr,
          file,
          line,
          remediation: issue.remediation || issue.recommendation || issue.fix || 'Review the Solana Fender finding and apply the recommended fix.',
        });
      });
    }
  }

  // Fallback: parse plain-text output line by line
  // Expected format: "[SEVERITY] Title at file.rs:line" or similar
  const lines = `${stdout}\n${stderr}`.split(/\r?\n/).filter(Boolean);
  const findings = [];
  const linePattern = /^\[?(CRITICAL|HIGH|MEDIUM|LOW|INFO|WARNING)\]?\s+(.+?)(?:\s+at\s+(\S+?)(?::(\d+))?)?$/i;
  for (const line of lines) {
    const match = line.match(linePattern);
    if (!match) continue;
    const [, severity, title, file, lineNum] = match;
    findings.push(finding({
      id: stableId('SWC', [title, file, lineNum]),
      tool: 'solana-fender',
      severity: normalizeSeverity(severity, 'medium'),
      title: title.trim(),
      description: title.trim(),
      file: file || 'unknown',
      line: lineNum ? Number(lineNum) : undefined,
      remediation: 'Review the Solana Fender finding and apply the recommended fix.',
    }));
  }
  return findings;
}

function parseToolOutputs(outputs) {
  const findings = [
    ...parseCargoAudit(outputs['cargo-audit']?.stdout, outputs['cargo-audit']?.stderr),
    ...parseCargoGeiger(outputs['cargo-geiger']?.stdout, outputs['cargo-geiger']?.stderr),
    ...parseClippy(outputs.clippy?.stdout, outputs.clippy?.stderr),
    ...parseSolanaFender(outputs['solana-fender']?.stdout, outputs['solana-fender']?.stderr),
  ];
  const dedupedFindings = Array.from(
    new Map(findings.map((item) => [
      [
        item.id,
        item.tool_source,
        item.file,
        item.line || '',
        item.title,
      ].join('|'),
      item,
    ])).values()
  );

  return dedupedFindings.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return a.file.localeCompare(b.file) || a.title.localeCompare(b.title);
  });
}

module.exports = {
  parseSolanaFender,
  parseCargoAudit,
  parseCargoGeiger,
  parseClippy,
  parseToolOutputs,
};
