/**
 * PDF generation using browser-native print + styled HTML.
 * Dark-theme Solana Security Workbench audit report.
 * Opens in a new tab; user saves as PDF via Ctrl+P / Cmd+P.
 */
import { summarizeFindings } from './analyzer';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg0:        '#06080b',
  bg1:        '#0d131b',
  bg2:        '#141d28',
  surface:    '#101722',
  border:     '#25364b',
  text1:      '#ecf3ff',
  text2:      '#b2c3d8',
  text3:      '#8398b0',
  accent:     '#c6ff2e',
  accentDim:  'rgba(198,255,46,0.12)',
};

const SEV = {
  critical: { bg: '#1a0505', border: '#7f1d1d', text: '#fca5a5', pill: '#ef4444', label: 'CRITICAL' },
  high:     { bg: '#1a0b00', border: '#7c2d12', text: '#fdba74', pill: '#f97316', label: 'HIGH'     },
  medium:   { bg: '#1a1500', border: '#713f12', text: '#fde68a', pill: '#eab308', label: 'MEDIUM'   },
  low:      { bg: '#051a05', border: '#14532d', text: '#86efac', pill: '#22c55e', label: 'LOW'      },
  info:     { bg: '#050a1a', border: '#1e3a5f', text: '#93c5fd', pill: '#3b82f6', label: 'INFO'     },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sevCard = (sev, count) => {
  const s = SEV[sev];
  return `
    <div style="flex:1;text-align:center;padding:18px 8px;
                background:${s.bg};border:1px solid ${s.border};
                border-radius:10px;min-width:80px;">
      <div style="font-size:32px;font-weight:700;color:${s.pill};
                  font-family:'Courier New',monospace;margin-bottom:4px;">${count}</div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;
                  color:${s.text};font-weight:600;">${s.label}</div>
    </div>`;
};

const toolBadge = (name) =>
  `<span style="display:inline-block;padding:2px 8px;background:${C.bg2};
     border:1px solid ${C.border};border-radius:4px;font-size:10px;
     color:${C.text3};font-family:'Courier New',monospace;margin:2px;">${esc(name)}</span>`;

// ── Main export ───────────────────────────────────────────────────────────────
export const generatePDF = (findings, projectName = 'Unknown Project', toolResults = {}) => {
  const summary   = summarizeFindings(findings);
  const now       = new Date();
  const scanDate  = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const scanTime  = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const tools     = Object.keys(toolResults).length
    ? Object.keys(toolResults)
    : ['cargo-audit', 'cargo-geiger', 'clippy', 'solana-fender'];
  const total     = findings.length;

  // ── Finding rows ────────────────────────────────────────────────────────────
  const findingRows = findings.map((f, i) => {
    const s   = SEV[f.severity] || SEV.info;
    const odd = i % 2 === 0;
    return `
      <tr style="background:${odd ? C.bg1 : C.bg0};border-bottom:1px solid ${C.border};">
        <td style="padding:10px 14px;font-family:'Courier New',monospace;font-size:10px;color:${C.text3};white-space:nowrap;">${esc(f.id)}</td>
        <td style="padding:10px 14px;white-space:nowrap;">
          <span style="background:${s.bg};border:1px solid ${s.border};color:${s.pill};
                       padding:3px 7px;border-radius:4px;font-size:10px;font-weight:700;
                       text-transform:uppercase;letter-spacing:0.06em;">${s.label}</span>
        </td>
        <td style="padding:10px 14px;color:${C.text1};font-size:12px;line-height:1.4;">${esc(f.title)}</td>
        <td style="padding:10px 14px;color:${C.text3};font-size:11px;font-family:'Courier New',monospace;white-space:nowrap;">${esc(f.tool || f.tool_source || '')}</td>
        <td style="padding:10px 14px;font-family:'Courier New',monospace;font-size:10px;color:${C.text3};white-space:nowrap;">${esc(f.location || f.filename || '—')}</td>
      </tr>
      <tr style="background:${odd ? C.bg1 : C.bg0};border-bottom:1px solid ${C.border};">
        <td colspan="5" style="padding:0 14px 14px 14px;">
          <div style="background:${C.bg2};border-left:3px solid ${s.border};border-radius:0 6px 6px 0;
                      padding:10px 12px;font-size:11px;color:${C.text2};line-height:1.55;">
            ${esc(f.description)}
          </div>
          ${f.remedy || f.remediation ? `
          <div style="margin-top:6px;font-size:11px;color:${C.accent};opacity:0.9;">
            <strong>Remediation:</strong> ${esc(f.remedy || f.remediation)}
          </div>` : ''}
        </td>
      </tr>`;
  }).join('');

  // ── HTML document ───────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>SSW Audit — ${esc(projectName)}</title>
  <style>
    /* Force dark colours through to print */
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

    body {
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${C.bg0};
      color: ${C.text1};
      padding: 40px 48px;
      min-height: 100vh;
    }

    /* Header */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 36px;
      padding-bottom: 28px;
      border-bottom: 1px solid ${C.border};
    }
    .logo-pill {
      display: inline-block;
      background: ${C.accent};
      color: #07100e;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.06em;
      margin-bottom: 12px;
    }
    h1 { font-size: 26px; font-weight: 700; color: #fff; margin: 6px 0 10px; }
    .meta { font-size: 12px; color: ${C.text3}; line-height: 1.6; }
    .total-badge {
      background: ${C.accentDim};
      border: 1px solid ${C.accent};
      color: ${C.accent};
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      white-space: nowrap;
      text-align: center;
    }
    .total-badge .num { font-size: 28px; display: block; margin-bottom: 2px; }

    /* Summary cards */
    .sev-grid { display: flex; gap: 12px; margin-bottom: 36px; }

    /* Findings table */
    table { width: 100%; border-collapse: collapse; }
    thead tr {
      background: ${C.surface};
      border-bottom: 1px solid ${C.border};
    }
    th {
      padding: 11px 14px;
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${C.text3};
      font-weight: 600;
    }

    /* Section heading */
    .section-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: ${C.accent};
      font-weight: 600;
      margin-bottom: 12px;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 18px;
      border-top: 1px solid ${C.border};
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: ${C.text3};
    }

    @media print {
      body { padding: 20px 28px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="logo-pill">⬡ SSW</div>
      <div style="font-size:11px;color:${C.accent};font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">
        Automated Security Audit Report
      </div>
      <h1>${esc(projectName)}</h1>
      <div class="meta">
        Scanned: ${esc(scanDate)} at ${esc(scanTime)}<br/>
        Tools: ${tools.map(toolBadge).join(' ')}
      </div>
    </div>
    <div class="total-badge">
      <span class="num">${total}</span>
      Finding${total !== 1 ? 's' : ''}
    </div>
  </div>

  <!-- Severity summary -->
  <div class="section-label">Severity Summary</div>
  <div class="sev-grid">
    ${['critical','high','medium','low','info'].map(s => sevCard(s, summary[s] ?? 0)).join('')}
  </div>

  <!-- Findings table -->
  <div class="section-label" style="margin-top:8px;">Findings</div>
  <table>
    <thead>
      <tr>
        <th style="width:90px;">ID</th>
        <th style="width:90px;">Severity</th>
        <th>Title</th>
        <th style="width:120px;">Tool</th>
        <th style="width:140px;">Location</th>
      </tr>
    </thead>
    <tbody>
      ${findingRows || `
        <tr style="background:${C.bg1};">
          <td colspan="5" style="padding:32px;text-align:center;color:${C.text3};">
            No findings — clean scan ✓
          </td>
        </tr>`}
    </tbody>
  </table>

  <!-- Footer -->
  <div class="footer">
    <span>Solana Security Workbench · Static analysis only · Not a substitute for manual review</span>
    <span>${esc(scanDate)}</span>
  </div>

  <script>
    // Auto-print after fonts load
    window.addEventListener('load', () => setTimeout(() => window.print(), 600));
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
};
