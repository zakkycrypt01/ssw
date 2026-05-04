import React from 'react';
import { Shield, CheckCircle2 } from 'lucide-react';
import type { Finding } from '../lib/analyzer';
import { SeverityChip } from './SeverityChip';
import { SevIcon } from './SevIcon';
import { ToolStatus } from './ToolStatus';

interface ToolResult {
  status: 'idle' | 'running' | 'done';
  message?: string;
}

interface FindingsPanelProps {
  activePanel: 'findings' | 'tools';
  onPanelChange: (panel: 'findings' | 'tools') => void;
  sortedFindings: Finding[];
  summary: Record<string, number>;
  scanDone: boolean;
  scanStatus: 'idle' | 'running' | 'done';
  findings: Finding[];
  selectedFinding: Finding | null;
  onFindingClick: (finding: Finding) => void;
  toolResults: Record<string, ToolResult>;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  activePanel,
  onPanelChange,
  sortedFindings,
  summary,
  scanDone,
  scanStatus,
  findings,
  selectedFinding,
  onFindingClick,
  toolResults,
}) => {
  return (
    <div className="ide-findings">
      <div className="panel-tabs">
        <div
          className={`panel-tab ${activePanel === 'findings' ? 'active' : ''}`}
          onClick={() => onPanelChange('findings')}
        >
          Findings {scanDone && `(${findings.length})`}
        </div>
        <div
          className={`panel-tab ${activePanel === 'tools' ? 'active' : ''}`}
          onClick={() => onPanelChange('tools')}
        >
          Tools
        </div>
      </div>

      {activePanel === 'findings' && (
        <>
          {scanDone && findings.length > 0 && (
            <div className="summary-row" style={{ flexWrap: 'wrap' }}>
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map(
                (sev) =>
                  summary[sev] > 0 && (
                    <span key={sev} className={`sev-chip sev-${sev}`}>
                      {summary[sev]} {sev}
                    </span>
                  )
              )}
            </div>
          )}

          {!scanDone && scanStatus === 'idle' && (
            <div className="panel-empty">
              <Shield
                size={28}
                color="var(--color-lemon)"
                style={{ opacity: 0.4 }}
              />
              <p>Run a scan to detect vulnerabilities in your code.</p>
            </div>
          )}

          {scanStatus === 'running' && (
            <div className="panel-empty">
              <span
                className="animate-pulse-glow"
                style={{
                  display: 'block',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--color-lemon)',
                }}
              />
              <p>Scanning…</p>
            </div>
          )}

          {scanDone && findings.length === 0 && (
            <div className="panel-empty">
              <CheckCircle2 size={28} color="#84cc16" />
              <p>No issues found — looking clean!</p>
            </div>
          )}

          <div className="findings-list">
            {sortedFindings.map((f) => (
              <div key={f.id}>
                <div
                  className={`finding-item ${
                    selectedFinding?.id === f.id ? 'selected' : ''
                  }`}
                  onClick={() => onFindingClick(f)}
                >
                  <div className="finding-header">
                    <SevIcon sev={f.severity} />
                    <SeverityChip sev={f.severity} small />
                    <span className="finding-title">{f.title}</span>
                  </div>
                  <div className="finding-meta">
                    <span className="finding-source">
                      {f.tool} · {f.id}
                    </span>
                    <span className="finding-loc">{f.location}</span>
                  </div>
                </div>
                {selectedFinding?.id === f.id && (
                  <div className="finding-detail">
                    <p className="finding-detail-desc">{f.description}</p>
                    <p className="finding-detail-remedy">
                      <strong>Remedy:</strong> {f.remedy}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {activePanel === 'tools' && (
        <div className="tools-panel">
          {Object.entries(toolResults).map(([name, result]) => (
            <ToolStatus key={name} name={name} result={result} />
          ))}
          {scanDone && (
            <div className="tool-summary-footer">
              4 tools completed · {findings.length} total finding
              {findings.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
