import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Code, FileText, Database } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="screen-wrap landing-screen">
      <div className="glass-panel">
        <div className="topbar">
          <span className="logo-pill">⬡ SSW</span>
          <div className="nav-links">
            <span className="nav-link active">Product</span>
            <span className="nav-link">Docs</span>
            <span className="nav-link">Vulnerability DB</span>
            <span className="nav-link">Pricing</span>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/ide')}
            style={{ marginLeft: '16px' }}
          >
            Launch IDE
          </button>
        </div>
        <div className="landing-hero">
          <div className="landing-hero-grid">
            <div>
              <div className="hero-eyebrow">Solana Smart Contract Security</div>
              <div className="hero-h1">
                Write. Scan. Audit.
                <br />
                All in your browser.
              </div>
              <div className="hero-sub">
                Security-first workspace for Solana and Anchor teams. Run chained
                analysis, inspect findings inline, and export stakeholder-ready reports
                in minutes.
              </div>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => navigate('/ide')}>
                  Open the IDE — it's free
                </button>
                <button className="btn btn-secondary">View sample report</button>
              </div>

              <div className="hero-metrics">
                <div className="hero-metric-card">
                  <div className="hero-metric-value">4</div>
                  <div className="hero-metric-label">Security Engines</div>
                </div>
                <div className="hero-metric-card">
                  <div className="hero-metric-value">25+</div>
                  <div className="hero-metric-label">Solana Patterns</div>
                </div>
                <div className="hero-metric-card">
                  <div className="hero-metric-value">1-Click</div>
                  <div className="hero-metric-label">Audit PDF Export</div>
                </div>
              </div>
            </div>

            <div className="hero-command-panel">
              <div className="hero-command-head">Live Security Signal</div>
              <div className="hero-signal-row">
                <span className="hero-signal-dot ok" />
                <span>cargo-audit</span>
                <span className="hero-signal-tag">1 advisory</span>
              </div>
              <div className="hero-signal-row">
                <span className="hero-signal-dot ok" />
                <span>cargo-geiger</span>
                <span className="hero-signal-tag">0 unsafe</span>
              </div>
              <div className="hero-signal-row">
                <span className="hero-signal-dot warn" />
                <span>Clippy + custom rules</span>
                <span className="hero-signal-tag">4 findings</span>
              </div>
              <div className="hero-signal-row">
                <span className="hero-signal-dot crit" />
                <span>Aderyn SAST</span>
                <span className="hero-signal-tag">2 critical</span>
              </div>

              <div className="hero-command-footer">
                Fast triage view for engineering, security, and product stakeholders.
              </div>
            </div>
          </div>
        </div>
        <div className="feature-strip">
          <div className="feat-item">
            <div className="feat-icon">
              <Code size={20} />
            </div>
            <div className="feat-title">Monaco Editor</div>
            <div className="feat-desc">VS Code-grade editor with Rust + Anchor syntax</div>
          </div>
          <div className="feat-item">
            <div className="feat-icon">
              <ShieldCheck size={20} />
            </div>
            <div className="feat-title">4-Tool Scanner</div>
            <div className="feat-desc">cargo-audit, geiger, Clippy, and Aderyn chained</div>
          </div>
          <div className="feat-item">
            <div className="feat-icon">
              <FileText size={20} />
            </div>
            <div className="feat-title">One-Click PDF</div>
            <div className="feat-desc">Professional audit report downloaded instantly</div>
          </div>
          <div className="feat-item">
            <div className="feat-icon">
              <Database size={20} />
            </div>
            <div className="feat-title">Vuln Database</div>
            <div className="feat-desc">25+ Solana-specific patterns with remediation</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
