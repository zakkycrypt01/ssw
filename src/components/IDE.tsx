import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Play } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { sortFindings, summarizeFindings, resetCounter, type Finding } from '../lib/analyzer';
import { generatePDF } from '../lib/pdfExport';
import { FileExplorer } from './FileExplorer';
import { EditorPanel } from './EditorPanel';
import { FindingsPanel } from './FindingsPanel';
import { NewFileModal } from './NewFileModal';

export const IDE: React.FC = () => {
  const navigate = useNavigate();
  const {
    files,
    activeFile,
    setActiveFile,
    updateFileContent,
    createFile,
    deleteFile,
    importFiles,
    findings,
    scanStatus,
    scanProgress,
    toolResults,
    lastScanAt,
    projectName,
    runScan,
  } = useApp();

  const [activePanel, setActivePanel] = useState<'findings' | 'tools'>('findings');
  const [showNewFile, setShowNewFile] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const editorRef = useRef<any>(null);

  const sorted = sortFindings(findings);
  const summary = summarizeFindings(findings);
  const scanDone = scanStatus === 'done';
  const scanRunning = scanStatus === 'running';

  const lastScanText = (() => {
    if (!lastScanAt) return 'Not yet scanned';
    const diff = Math.floor((Date.now() - lastScanAt.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  })();

  const handleScan = (): void => {
    resetCounter();
    runScan();
    navigate('/scanning');
  };

  const jumpToLine = (lineNumber: number): void => {
    if (!editorRef.current || !lineNumber) return;
    editorRef.current.revealLineInCenter(lineNumber);
    editorRef.current.setPosition({ lineNumber, column: 1 });
    editorRef.current.focus();
  };

  const handleFindingClick = (f: Finding): void => {
    setSelectedFinding(f.id === selectedFinding?.id ? null : f);
    if (f.filename && files[f.filename]) {
      setActiveFile(f.filename);
      if (f.lineNumber) {
        setTimeout(() => jumpToLine(f.lineNumber!), 100);
      }
    }
  };

  const handleExport = (): void => {
    generatePDF(sorted, 'my-project', toolResults);
  };

  const projectName = Object.keys(files)[0]?.replace('.rs', '') ?? 'project';

  return (
    <div className="ide-root">
      {/* ── Top Bar ── */}
      <div className="ide-topbar">
        <span
          className="logo-pill"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          ⬡ SSW
        </span>
        <span className="ide-project-name">{projectName}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {scanRunning && (
            <div className="scan-progress-bar">
              <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }} />
            </div>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
            disabled={!scanDone}
          >
            <Download size={13} /> PDF Report
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleScan}
            disabled={scanRunning}
          >
            <Play size={13} /> {scanRunning ? 'Scanning…' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* ── Main 3-col layout ── */}
      <div className="ide-body">
        <FileExplorer
          files={files}
          activeFile={activeFile}
          findings={findings}
          projectName={projectName}
          onSelectFile={setActiveFile}
          onCreateFile={() => setShowNewFile(true)}
          onDeleteFile={deleteFile}
          onImportFiles={importFiles}
          summary={summary}
          scanDone={scanDone}
        />

        <EditorPanel
          files={files}
          activeFile={activeFile}
          lastScanText={lastScanText}
          findings={findings}
          scanDone={scanDone}
          onFileChange={updateFileContent}
          onSelectFile={setActiveFile}
          onDeleteFile={deleteFile}
          onEditorMount={(editor) => {
            editorRef.current = editor;
          }}
        />

        <FindingsPanel
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          sortedFindings={sorted}
          summary={summary}
          scanDone={scanDone}
          scanStatus={scanStatus}
          findings={findings}
          selectedFinding={selectedFinding}
          onFindingClick={handleFindingClick}
          toolResults={toolResults}
        />
      </div>

      {showNewFile && (
        <NewFileModal
          onConfirm={(name) => {
            createFile(name);
            setShowNewFile(false);
          }}
          onClose={() => setShowNewFile(false)}
        />
      )}
    </div>
  );
};

export default IDE;
