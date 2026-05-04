/**
 * PDF generation using browser-native print + styled HTML.
 * Opens the report in a new window which the user can print/save as PDF.
 */
import { summarizeFindings, Finding } from './analyzer';

interface SevColor {
  bg: string;
  border: string;
  text: string;
  label: string;
}

interface ToolResult {
  status: 'idle' | 'running' | 'done';
  message?: string;
}

const SEV_COLORS: Record<'critical' | 'high' | 'medium' | 'low' | 'info', SevColor> = {
  critical: {
    bg: '#2a0a0a',
    border: '#7f1d1d',
    text: '#fca5a5',
    label: '#ef4444',
  },
  high: { bg: '#2a1300', border: '#7c2d12', text: '#fdba74', label: '#f97316' },
  medium: {
    bg: '#2a1f00',
    border: '#713f12',
    text: '#fde68a',
    label: '#eab308',
  },
  low: { bg: '#0a1f0a', border: '#14532d', text: '#86efac', label: '#22c55e' },
  info: {
    bg: '#0a0f2a',
    border: '#1e3a5f',
    text: '#93c5fd',
    label: '#3b82f6',
  },
};

export const generatePDF = (
  findings: Finding[],
  projectName: string = 'Unknown Project',
  toolResults: Record<string, ToolResult> = {}
): void => {
  const summary = summarizeFindings(findings);
  const now = new Date();
  const scannedAt = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const tools =
    Object.keys(toolResults).join(', ') ||
    'cargo-audit, cargo-geiger, clippy, aderyn';
  const totalFindings = findings.length;

  const sevRow = (sev: 'critical' | 'high' | 'medium' | 'low' | 'info'): string => {
    const c = SEV_COLORS[sev];
    return `
      <div style="flex:1;text-align:center;padding:16px 8px;background:${c.bg};border:1px solid ${c.border};border-radius:8px;">
        <div style="font-size:28px;font-weight:700;color:${c.label};margin-bottom:4px;">${summary[sev] ?? 0}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:${c.text};">${sev}</div>
      </div>`;
  };

  const findingRows = findings
    .map((f, i) => {
      const c = SEV_COLORS[f.severity];
      return `
      <tr style="background:${i % 2 === 0 ? '#0d0d10' : '#0a0a0c'}">
        <td style="padding:10px 14px;font-family:monospace;font-size:11px;color:#64748b;">${f.id}</td>
        <td style="padding:10px 14px;">
          <span style="background:${c.bg};border:1px solid ${c.border};color:${c.label};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">${f.severity}</span>
        </td>
        <td style="padding:10px 14px;color:#e2e8f0;font-size:13px;">${f.title}</td>
        <td style="padding:10px 14px;color:#64748b;font-size:12px;">${f.tool}</td>
        <td style="padding:10px 14px;font-family:monospace;font-size:11px;color:#94a3b8;">${f.location}</td>
      </tr>
      <tr style="background:${i % 2 === 0 ? '#0d0d10' : '#0a0a0c'}">
        <td colspan="5" style="padding:0 14px 12px 14px;">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">${f.description}</div>
          <div style="font-size:12px;color:#ccff00;opacity:0.8;"><strong>Remedy:</strong> ${f.remedy}</div>
        </td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>SSW Audit Report — ${projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0c; color: #e2e8f0; padding: 40px; }
    h1 { font-size: 24px; font-weight: 600; color: #fff; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th { background: #111116; color: #64748b; padding: 10px 14px; text-align: left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid #1e2030; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #1e2030;">
    <div>
      <div style="font-size:12px;color:#ccff00;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Automated Security Audit</div>
      <h1>${projectName}</h1>
      <div style="font-size:12px;color:#64748b;margin-top:8px;">Scanned: ${scannedAt} · Tools: ${tools}</div>
    </div>
    <div style="background:rgba(204,255,0,0.1);border:1px solid #ccff00;color:#ccff00;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:600;white-space:nowrap;">
      ${totalFindings} Finding${totalFindings !== 1 ? 's' : ''}
    </div>
  </div>
  
  <div style="display:flex;gap:16px;margin-bottom:32px;">
    ${(['critical', 'high', 'medium', 'low', 'info'] as const).map(sevRow).join('')}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:80px">ID</th>
        <th style="width:100px">Severity</th>
        <th>Title</th>
        <th style="width:130px">Tool</th>
        <th style="width:140px">Location</th>
      </tr>
    </thead>
    <tbody>
      ${findingRows || '<tr><td colspan="5" style="padding:24px;text-align:center;color:#64748b;">No findings — great work!</td></tr>'}
    </tbody>
  </table>

  <div style="margin-top:32px;font-size:11px;color:#475569;text-align:right;">
    Generated by Solana Security Workbench · Static analysis only · Not a substitute for manual audit
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }
};
