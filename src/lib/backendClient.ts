import type { Finding } from './analyzer';

interface FileContent {
  name: string;
  content: string;
}

interface BackendFinding {
  id: string;
  tool_source: Finding['tool'];
  severity: Finding['severity'];
  title: string;
  description: string;
  file: string;
  line?: number;
  remediation: string;
  location?: string;
}

interface ScanResponse {
  findings: BackendFinding[];
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const scanProject = async (
  projectName: string,
  files: Record<string, FileContent>
): Promise<{ findings: Finding[]; raw: ScanResponse }> => {
  const response = await fetch(`${API_BASE}/api/v1/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      project_name: projectName,
      files: Object.values(files).map((file) => ({
        path: file.name,
        content: file.content,
      })),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Scan API failed (${response.status}): ${message}`);
  }

  const raw = (await response.json()) as ScanResponse;
  return {
    raw,
    findings: raw.findings.map((finding) => ({
      id: finding.id,
      tool: finding.tool_source,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      remedy: finding.remediation,
      filename: finding.file,
      lineNumber: finding.line,
      location: finding.location || (finding.line ? `${finding.file}:${finding.line}` : finding.file),
    })),
  };
};
