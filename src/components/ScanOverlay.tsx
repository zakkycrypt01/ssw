import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

const ScanOverlay: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/report');
    }, 4000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="screen-wrap scan-screen">
      <div className="glass-panel scan-overlay">
        <div className="scan-headline">Scanning your contract…</div>

        <div className="scan-tool-grid">
          <div className="scan-tool-card">
            <CheckCircle2 size={16} color="#84cc16" />
            <div>
              <div className="scan-tool-name">cargo-audit</div>
              <div className="scan-tool-msg">Complete — 1 advisory</div>
            </div>
          </div>
          <div className="scan-tool-card">
            <CheckCircle2 size={16} color="#84cc16" />
            <div>
              <div className="scan-tool-name">cargo-geiger</div>
              <div className="scan-tool-msg">Complete — 0 unsafe</div>
            </div>
          </div>
          <div className="scan-tool-card running">
            <div className="scan-tool-dot running animate-pulse-glow" />
            <div>
              <div className="scan-tool-name">Clippy lints</div>
              <div className="scan-tool-msg running">Running…</div>
            </div>
          </div>
          <div className="scan-tool-card queued">
            <div className="scan-tool-dot" />
            <div>
              <div className="scan-tool-name">Aderyn SAST</div>
              <div className="scan-tool-msg">Queued</div>
            </div>
          </div>
        </div>

        <div className="scan-progress-track">
          <div className="scan-progress-fill" />
        </div>

        <div className="scan-note">
          Sandboxed container · no network access · auto-timeout 120s
        </div>
      </div>
    </div>
  );
};

export default ScanOverlay;
