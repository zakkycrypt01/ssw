function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderReportHtml({ projectName, companyName, findings, summary, metadata }) {
  const rows = findings.map((finding) => `
    <tr>
      <td>${escapeHtml(finding.id)}</td>
      <td><span class="sev ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span></td>
      <td>${escapeHtml(finding.title)}</td>
      <td>${escapeHtml(finding.tool_source)}</td>
      <td>${escapeHtml(finding.location || finding.file)}</td>
    </tr>
    <tr class="detail">
      <td colspan="5">
        <strong>Description:</strong> ${escapeHtml(finding.description)}<br/>
        <strong>Remediation:</strong> ${escapeHtml(finding.remediation)}
      </td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>SSW Audit Report - ${escapeHtml(projectName)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #111827; }
    header { border-bottom: 2px solid #111827; padding-bottom: 18px; margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    .muted { color: #6b7280; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
    .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; }
    .box strong { display:block; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 9px; text-align: left; font-size: 12px; vertical-align: top; }
    th { background: #f9fafb; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }
    .detail td { color: #374151; background: #fbfbfc; }
    .sev { border-radius: 4px; padding: 3px 7px; color: white; text-transform: uppercase; font-size: 10px; }
    .critical { background: #991b1b; } .high { background: #c2410c; } .medium { background: #a16207; }
    .low { background: #15803d; } .info { background: #2563eb; }
  </style>
</head>
<body>
  <header>
    <div class="muted">${escapeHtml(companyName || 'Solana Security Workbench')}</div>
    <h1>${escapeHtml(projectName)}</h1>
    <div class="muted">Scanned ${escapeHtml(metadata?.scanned_at || new Date().toISOString())} · Engine ${escapeHtml(metadata?.engine_version || '1.0.0')}</div>
  </header>
  <section>
    <h2>Executive Summary</h2>
    <p>${summary.total} automated finding${summary.total === 1 ? '' : 's'} detected. Automated scanning is a preliminary control and does not replace manual review.</p>
    <div class="summary">
      ${['critical', 'high', 'medium', 'low', 'info'].map((sev) => `<div class="box"><strong>${summary[sev] || 0}</strong>${sev}</div>`).join('')}
    </div>
  </section>
  <section>
    <h2>Findings</h2>
    <table>
      <thead><tr><th>ID</th><th>Severity</th><th>Title</th><th>Tool</th><th>Location</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No findings detected.</td></tr>'}</tbody>
    </table>
  </section>
</body>
</html>`;
}

module.exports = { renderReportHtml };
