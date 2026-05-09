import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Finding, analyzeCode } from '../lib/analyzer';
import { scanProject } from '../lib/backendClient';

interface FileContent {
  name: string;
  language: 'rust' | 'toml' | 'plaintext';
  content: string;
}

interface ToolResult {
  status: 'idle' | 'running' | 'done';
  message: string;
}

interface AppContextType {
  files: Record<string, FileContent>;
  activeFile: string;
  setActiveFile: (filename: string) => void;
  updateFileContent: (filename: string, content: string) => void;
  createFile: (name: string) => void;
  deleteFile: (name: string) => void;
  importFiles: (files: Record<string, FileContent>, newProjectName?: string) => void;
  findings: Finding[];
  scanStatus: 'idle' | 'running' | 'done' | 'error';
  scanProgress: number;
  toolResults: Record<string, ToolResult>;
  lastScanAt: Date | null;
  projectName: string;
  runScan: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// Empty workspace — user imports their project files
const DEFAULT_FILES: Record<string, FileContent> = {};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [files, setFiles] = useState<Record<string, FileContent>>(() => {
    try {
      const saved = localStorage.getItem('ssw_files');
      return saved ? JSON.parse(saved) : DEFAULT_FILES;
    } catch {
      return DEFAULT_FILES;
    }
  });

  const [activeFile, setActiveFile] = useState<string>(() => {
    return localStorage.getItem('ssw_activeFile') || '';
  });

  useEffect(() => {
    localStorage.setItem('ssw_files', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem('ssw_activeFile', activeFile);
  }, [activeFile]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanStatus, setScanStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [toolResults, setToolResults] = useState<Record<string, ToolResult>>({
    'cargo-audit': { status: 'idle', message: '' },
    'cargo-geiger': { status: 'idle', message: '' },
    clippy: { status: 'idle', message: '' },
    'solana-fender': { status: 'idle', message: '' },
  });
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);

  const [projectName, setProjectName] = useState<string>(() => {
    return localStorage.getItem('ssw_projectName') || 'Untitled Solana Project';
  });

  useEffect(() => {
    localStorage.setItem('ssw_projectName', projectName);
  }, [projectName]);

  const updateFileContent = useCallback((filename: string, content: string) => {
    setFiles((prev) => ({
      ...prev,
      [filename]: { ...prev[filename], content },
    }));
  }, []);

  const createFile = useCallback((name: string) => {
    const isRust = name.endsWith('.rs');
    const isToml = name.endsWith('.toml');
    const language: 'rust' | 'toml' | 'plaintext' = isRust
      ? 'rust'
      : isToml
        ? 'toml'
        : 'plaintext';
    setFiles((prev) => ({
      ...prev,
      [name]: { name, language, content: '' },
    }));
    setActiveFile(name);
  }, []);

  const deleteFile = useCallback(
    (name: string) => {
      setFiles((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setActiveFile((prev) => (prev === name ? Object.keys(files)[0] : prev));
    },
    [files]
  );

  const importFiles = useCallback((importedFiles: Record<string, FileContent>, newProjectName?: string) => {
    setFiles(importedFiles);
    if (newProjectName) {
      setProjectName(newProjectName);
    }
  }, []);

  // Backend Docker scanner pipeline
  const runScan = useCallback(async () => {
    if (scanStatus === 'running') return;

    setScanStatus('running');
    setScanProgress(10);
    setFindings([]);

    setToolResults({
      'cargo-audit': { status: 'running', message: 'Checking dependencies…' },
      'cargo-geiger': { status: 'running', message: 'Scanning for unsafe code…' },
      clippy: { status: 'running', message: 'Linting…' },
      'solana-fender': { status: 'running', message: 'Running Solana SAST…' },
    });

    const scanPromise = scanProject(projectName, files);

    let allFindings: Finding[] = [];
    try {
      setScanProgress(50);
      const result = await scanPromise;
      allFindings = result.findings;
    } catch (error) {
      console.error("Docker backend scan failed:", error);
      const errMsg = error instanceof Error ? error.message : 'Backend scan failed';
      setToolResults({
        'cargo-audit': { status: 'done', message: 'Failed' },
        'cargo-geiger': { status: 'done', message: 'Failed' },
        clippy: { status: 'done', message: 'Failed' },
        'solana-fender': { status: 'done', message: errMsg },
      });
      setScanProgress(100);
      setScanStatus('error');
      setLastScanAt(new Date());
      return;
    }

    setScanProgress(100);

    const auditFindings = allFindings.filter((f) => f.tool === 'cargo-audit');
    const geigerFindings = allFindings.filter((f) => f.tool === 'cargo-geiger');
    const clippyFindings = allFindings.filter((f) => f.tool === 'clippy');
    const fenderFindings = allFindings.filter((f) => f.tool === 'solana-fender');

    setToolResults({
      'cargo-audit': {
        status: 'done',
        message: auditFindings.length > 0 ? `${auditFindings.length} advisor${auditFindings.length > 1 ? 'ies' : 'y'}` : 'Clean',
      },
      'cargo-geiger': {
        status: 'done',
        message: geigerFindings.length > 0 ? `${geigerFindings.length} unsafe block(s)` : '0 unsafe',
      },
      clippy: {
        status: 'done',
        message: clippyFindings.length > 0 ? `${clippyFindings.length} lint(s)` : 'Clean',
      },
      'solana-fender': {
        status: 'done',
        message: fenderFindings.length > 0 ? `${fenderFindings.length} issue(s)` : 'Clean',
      },
    });

    setFindings(allFindings);
    setScanStatus('done');
    setLastScanAt(new Date());
  }, [files, scanStatus]);

  const value: AppContextType = {
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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
