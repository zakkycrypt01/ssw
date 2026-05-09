import React, { useRef, useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Upload,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import JSZip from 'jszip';
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
  projectName?: string;
  onSelectFile: (filename: string) => void;
  onCreateFile: () => void;
  onDeleteFile: (filename: string) => void;
  onImportFiles: (files: Record<string, FileContent>, projectName?: string) => void;
  summary?: Record<string, number>;
  scanDone?: boolean;
}

const SUPPORTED_EXTENSIONS = ['.rs', '.toml', '.txt', '.md'];

// ── File icon by extension ──────────────────────────────────────────────────
function FileIcon({ name }: { name: string }) {
  if (name.endsWith('.rs'))
    return <span style={{ fontSize: 13, color: '#f472b6', fontWeight: 700, lineHeight: 1 }}>rs</span>;
  if (name.endsWith('.toml'))
    return <span style={{ fontSize: 13, color: '#a3e635', fontWeight: 700, lineHeight: 1 }}>⚙</span>;
  if (name.endsWith('.md'))
    return <span style={{ fontSize: 13, color: '#60a5fa', fontWeight: 700, lineHeight: 1 }}>M↓</span>;
  if (name.endsWith('.lock'))
    return <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700, lineHeight: 1 }}>🔒</span>;
  return <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700, lineHeight: 1 }}>·</span>;
}

// ── Build a directory tree from flat file paths ─────────────────────────────
interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(filePaths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const filePath of filePaths) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');

      let node = current.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path, isDir: !isLast, children: [] };
        current.push(node);
      }
      if (!isLast) current = node.children;
    }
  }

  // Sort: directories first, then files, alphabetically
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return sortNodes(root);
}

// ── Tree node component ─────────────────────────────────────────────────────
interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  activeFile: string;
  openDirs: Set<string>;
  findings: Finding[];
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}

const TreeNodeRow: React.FC<TreeNodeProps> = ({
  node,
  depth,
  activeFile,
  openDirs,
  findings,
  onToggleDir,
  onSelectFile,
  onDeleteFile,
}) => {
  const isOpen = openDirs.has(node.path);
  const isActive = !node.isDir && node.path === activeFile;
  const hasFinding = findings.some((f) => f.filename === node.path);
  const indent = depth * 12;

  if (node.isDir) {
    return (
      <>
        <div
          className={`vsc-tree-row vsc-dir${isOpen ? ' open' : ''}`}
          style={{ paddingLeft: 8 + indent }}
          onClick={() => onToggleDir(node.path)}
        >
          <span className="vsc-chevron">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="vsc-folder-icon">
            {isOpen ? <FolderOpen size={14} color="#dcb67a" /> : <Folder size={14} color="#dcb67a" />}
          </span>
          <span className="vsc-label">{node.name}</span>
        </div>
        {isOpen &&
          node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              openDirs={openDirs}
              findings={findings}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
            />
          ))}
      </>
    );
  }

  return (
    <div
      className={`vsc-tree-row vsc-file${isActive ? ' active' : ''}`}
      style={{ paddingLeft: 8 + indent + 18 }}
      onClick={() => onSelectFile(node.path)}
    >
      <span className="vsc-file-icon">
        <FileIcon name={node.name} />
      </span>
      <span className="vsc-label" style={{ flex: 1 }}>{node.name}</span>
      {hasFinding && <span className="vsc-finding-dot" />}
      <button
        className="vsc-delete-btn"
        title="Delete file"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteFile(node.path);
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ── Main FileExplorer component ─────────────────────────────────────────────
export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFile,
  findings,
  projectName = 'EXPLORER',
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onImportFiles,
  summary = {},
  scanDone = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set(['src']));
  const [sectionOpen, setSectionOpen] = useState(true);

  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  const toggleDir = (path: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const getFileLanguage = (filename: string): 'rust' | 'toml' | 'plaintext' => {
    if (filename.endsWith('.rs')) return 'rust';
    if (filename.endsWith('.toml')) return 'toml';
    return 'plaintext';
  };

  const processFiles = (fileList: File[]): Promise<Record<string, FileContent>> => {
    return Promise.all(
      fileList.map(
        (f) =>
          new Promise<[string, any]>((resolve) => {
            if (f.name.endsWith('.zip')) {
              const reader = new FileReader();
              reader.onload = async (ev) => {
                try {
                  const zip = new JSZip();
                  await zip.loadAsync(ev.target?.result as ArrayBuffer);
                  const extracted: Record<string, FileContent> = {};
                  const validEntries = Object.entries(zip.files).filter(([path, file]) => {
                    if (file.dir) return false;
                    return SUPPORTED_EXTENSIONS.some((ext) => path.endsWith(ext));
                  });
                  let commonRoot = '';
                  if (validEntries.length > 0) {
                    const firstPath = validEntries[0][0];
                    const firstRoot = firstPath.split('/')[0] + '/';
                    const allShareRoot = validEntries.every(([p]) => p.startsWith(firstRoot));
                    if (allShareRoot && firstPath.includes('/')) commonRoot = firstRoot;
                  }
                  for (const [path, file] of validEntries) {
                    const content = await file.async('text');
                    const normalizedPath = commonRoot ? path.substring(commonRoot.length) : path;
                    extracted[normalizedPath] = {
                      name: normalizedPath,
                      language: getFileLanguage(normalizedPath),
                      content,
                    };
                  }
                  resolve(['__zip_extracted__', extracted]);
                } catch (error) {
                  console.error('Failed to extract zip:', error);
                  resolve(['__error__', null]);
                }
              };
              reader.readAsArrayBuffer(f);
            } else {
              const reader = new FileReader();
              reader.onload = (ev) => {
                resolve([
                  f.name,
                  { name: f.name, language: getFileLanguage(f.name), content: (ev.target?.result as string) || '' },
                ]);
              };
              reader.readAsText(f);
            }
          })
      )
    ).then((results) => {
      const imported: Record<string, FileContent> = {};
      const zipExtracted: Record<string, FileContent> = {};
      for (const [key, value] of results) {
        if (key === '__zip_extracted__' && value) Object.assign(zipExtracted, value);
        else if (key !== '__error__' && value) imported[key] = value;
      }
      return { ...imported, ...zipExtracted };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    const imported = await processFiles(fileList);
    if (Object.keys(imported).length > 0) {
      const name = fileList.find((f) => f.name.endsWith('.zip'))?.name.replace(/\.zip$/i, '');
      onImportFiles(imported, name);
      // Auto-open all directories from uploaded files
      const dirs = new Set<string>();
      for (const path of Object.keys(imported)) {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join('/'));
        }
      }
      setOpenDirs(dirs);
      onSelectFile(Object.keys(imported)[0]);
    }
    e.target.value = '';
  };

  return (
    <div className="vsc-sidebar">
      {/* ── Explorer header ── */}
      <div className="vsc-sidebar-header">
        <span className="vsc-header-title">EXPLORER</span>
        <div className="vsc-header-actions">
          <button className="vsc-icon-btn" title="New File" onClick={onCreateFile}>
            <FilePlus size={15} />
          </button>
          <button className="vsc-icon-btn" title="New Folder (not supported)" disabled>
            <FolderPlus size={15} />
          </button>
          <button className="vsc-icon-btn" title="Open Folder / Import Files" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} />
          </button>
          <button className="vsc-icon-btn" title="Collapse All" onClick={() => setOpenDirs(new Set())}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Project section ── */}
      <div
        className="vsc-section-header"
        onClick={() => setSectionOpen((v) => !v)}
      >
        <span className="vsc-chevron">
          {sectionOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="vsc-section-title">
          {projectName?.toUpperCase() || 'NO FOLDER OPENED'}
        </span>
      </div>

      {sectionOpen && (
        <div className="vsc-tree">
          {tree.length === 0 ? (
            <div className="vsc-empty">
              <Upload size={20} style={{ opacity: 0.4 }} />
              <p>No folder opened.</p>
              <button
                className="vsc-open-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Open Folder
              </button>
            </div>
          ) : (
            tree.map((node) => (
              <TreeNodeRow
                key={node.path}
                node={node}
                depth={0}
                activeFile={activeFile}
                openDirs={openDirs}
                findings={findings}
                onToggleDir={toggleDir}
                onSelectFile={onSelectFile}
                onDeleteFile={onDeleteFile}
              />
            ))
          )}
        </div>
      )}

      {/* ── Scan summary ── */}
      {scanDone && Object.values(summary).some((v) => v > 0) && (
        <div className="vsc-scan-summary">
          <div className="vsc-scan-summary-title">
            <Shield size={12} /> Scan Summary
          </div>
          {(['critical', 'high', 'medium', 'low', 'info'] as const).map(
            (sev) =>
              summary[sev] > 0 && (
                <div key={sev} className="vsc-scan-summary-row">
                  <span className={`sev-dot sev-dot-${sev}`} />
                  <span className="vsc-scan-summary-label">{sev}</span>
                  <span className="vsc-scan-summary-count">{summary[sev]}</span>
                </div>
              )
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".rs,.toml,.txt,.md,.zip"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
    </div>
  );
};
