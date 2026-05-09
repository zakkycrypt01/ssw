import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../store/AppContext';

const ScanOverlay: React.FC = () => {
  const navigate = useNavigate();
  const { scanStatus, toolResults, scanProgress } = useApp();

  useEffect(() => {
    if (scanStatus === 'done') {
      // Redirect back to IDE to see findings in the FindingsPanel
      navigate('/ide');
    }
  }, [scanStatus, navigate]);

  const renderTool = (name: string, key: string) => {
    const result = toolResults[key] || { status: 'idle', message: 'Queued' };
    let cardClass = 'scan-tool-card';
    if (result.status === 'running') cardClass += ' running';
    if (result.status === 'idle') cardClass += ' queued';

    return (
      <div className={cardClass} key={key}>
        {result.status === 'done' ? (
          <CheckCircle2 size={16} color="#84cc16" />
        ) : result.status === 'running' ? (
          <div className="scan-tool-dot running animate-pulse-glow" />
        ) : (
          <div className="scan-tool-dot" />
        )}
        <div>
          <div className="scan-tool-name">{name}</div>
          <div className={`scan-tool-msg ${result.status === 'running' ? 'running' : ''}`}>
            {result.message}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="screen-wrap scan-screen">
      <div className="glass-panel scan-overlay">
        <div className="scan-headline">
          {scanStatus === 'error' ? 'Scan Failed' : 'Scanning your contract…'}
        </div>

        <div className="scan-tool-grid">
          {renderTool('cargo-audit', 'cargo-audit')}
          {renderTool('cargo-geiger', 'cargo-geiger')}
          {renderTool('Clippy lints', 'clippy')}
          {renderTool('Solana Fender', 'solana-fender')}
        </div>

        <div className="scan-progress-track">
          <div
            className="scan-progress-fill"
            style={{
              width: `${scanProgress}%`,
              transition: 'width 0.3s ease',
              backgroundColor: scanStatus === 'error' ? '#ef4444' : 'var(--color-lemon)'
            }}
          />
        </div>

        <div className="scan-note">
          {scanStatus === 'error' ? (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/ide')}>
              Back to Workspace
            </button>
          ) : (
            'First scan compiles Anchor deps (~3-5 min). Subsequent scans are faster.'
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanOverlay;
