import React from 'react';
import Editor from '@monaco-editor/react';
import { FileCode2 } from 'lucide-react';

interface FileContent {
  name: string;
  language: 'rust' | 'toml' | 'plaintext';
  content: string;
}

interface EditorPanelProps {
  files: Record<string, FileContent>;
  activeFile: string;
  lastScanText: string;
  findings: any[];
  scanDone: boolean;
  onFileChange: (filename: string, content: string) => void;
  onSelectFile: (filename: string) => void;
  onEditorMount: (editor: any) => void;
}

const LANG_ICON_COLOR: Record<string, string> = {
  rust: '#f472b6',
  toml: '#a3e635',
  plaintext: '#94a3b8',
};

export const EditorPanel: React.FC<EditorPanelProps> = ({
  files,
  activeFile,
  lastScanText,
  findings,
  scanDone,
  onFileChange,
  onSelectFile,
  onEditorMount,
}) => {
  const currentFile = files[activeFile];

  return (
    <div className="ide-editor">
      {/* Tab bar */}
      <div className="editor-tabs">
        {Object.values(files).map((f) => (
          <div
            key={f.name}
            className={`editor-tab ${f.name === activeFile ? 'active' : ''}`}
            onClick={() => onSelectFile(f.name)}
          >
            <FileCode2 size={11} color={LANG_ICON_COLOR[f.language] ?? '#94a3b8'} />
            {f.name}
          </div>
        ))}
      </div>

      <div className="editor-canvas">
        {currentFile ? (
          <Editor
            key={activeFile}
            height="100%"
            language={currentFile.language}
            theme="vs-dark"
            value={currentFile.content}
            onChange={(val) => onFileChange(activeFile, val ?? '')}
            onMount={onEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              lineHeight: 1.7,
              renderLineHighlight: 'gutter',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              tabSize: 4,
            }}
          />
        ) : (
          <div className="editor-empty">No file selected</div>
        )}
      </div>

      {/* Status bar */}
      <div className="ide-statusbar">
        <div className="status-dot animate-pulse-glow" />
        <span>{lastScanText}</span>
        {scanDone && (
          <span>
            · {findings.length} finding{findings.length !== 1 ? 's' : ''}
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {currentFile?.language} · UTF-8
        </span>
      </div>
    </div>
  );
};
