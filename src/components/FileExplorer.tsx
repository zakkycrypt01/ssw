import React, { useRef } from 'react';
import { FileCode2, FilePlus, FolderOpen, X, Shield } from 'lucide-react';
import type { Finding } from '../lib/analyzer';

interface FileContent {
  name: string;
  language: 'rust' | 'toml' | 'plaintext';
  content: string;
}

interface FileExplorerProps {
  files: Record<string, FileContent>;
  activeFile: string;
  findings: Finding[];
  onSelectFile: (filename: string) => void;
  onCreateFile: () => void;
  onDeleteFile: (filename: string) => void;
  onImportFiles: (files: Record<string, FileContent>) => void;
  summary?: Record<string, number>;
  scanDone?: boolean;
}

const LANG_ICON_COLOR: Record<string, string> = {
  rust: '#f472b6',
  toml: '#a3e635',
  plaintext: '#94a3b8',
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFile,
  findings,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onImportFiles,
  summary = {},
  scanDone = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    const imported: Record<string, FileContent> = {};
    let done = 0;

    for (const f of fileList) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const lang = f.name.endsWith('.rs')
          ? 'rust'
          : f.name.endsWith('.toml')
            ? 'toml'
            : 'plaintext';
        imported[f.name] = {
          name: f.name,
          language: lang as 'rust' | 'toml' | 'plaintext',
          content: (ev.target?.result as string) || '',
        };
        done++;
        if (done === fileList.length) onImportFiles(imported);
      };
      reader.readAsText(f);
    }
    e.target.value = '';
  };

  return (
    <div className="ide-sidebar">
      <div className="sidebar-section">Explorer</div>
      {Object.values(files).map((f) => (
        <div
          key={f.name}
          className={`file-item ${f.name === activeFile ? 'active' : ''}`}
          onClick={() => onSelectFile(f.name)}
        >
          <FileCode2 size={13} color={LANG_ICON_COLOR[f.language] ?? '#94a3b8'} />
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {f.name}
          </span>
          {findings.some((fi) => fi.filename === f.name) && (
            <span className="file-badge-dot" />
          )}
          {Object.keys(files).length > 1 && (
            <X
              size={11}
              className="file-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(f.name);
              }}
            />
          )}
        </div>
      ))}

      <div className="sidebar-section" style={{ marginTop: '16px' }}>
        Actions
      </div>
      <div className="file-item file-action" onClick={onCreateFile}>
        <FilePlus size={13} /> New File
      </div>
      <div className="file-item file-action" onClick={handleImportClick}>
        <FolderOpen size={13} /> Import Files
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".rs,.toml,.txt"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Scan summary in sidebar */}
      {scanDone && (
        <div className="sidebar-scan-summary">
          <div className="scan-summary-title">
            <Shield size={12} /> Scan Summary
          </div>
          {(['critical', 'high', 'medium', 'low', 'info'] as const).map(
            (sev) =>
              summary[sev] > 0 && (
                <div key={sev} className="scan-summary-row">
                  <span className={`sev-dot sev-dot-${sev}`} />
                  <span className="scan-summary-label">{sev}</span>
                  <span className="scan-summary-count">{summary[sev]}</span>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
};
