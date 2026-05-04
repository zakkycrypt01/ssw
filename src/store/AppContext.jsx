import React, { createContext, useContext, useState, useCallback } from 'react';
import { analyzeCode } from '../lib/analyzer';

const AppContext = createContext(null);

// Default starter project — user can replace/add files
const DEFAULT_FILES = {
  'lib.rs': {
    name: 'lib.rs',
    language: 'rust',
    content: `use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWxTWqSBFTQXcRqHM2xHo7J8FJez");

#[program]
pub mod staking {
    use super::*;

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        // TODO: add owner validation
        ctx.accounts.vault.amount += amount;
        let result = amount * 100; // unchecked arithmetic
        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        ctx.accounts.vault.amount -= amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    pub user: Signer<'info>,
}

#[account]
pub struct Vault {
    pub amount: u64,
    pub owner: Pubkey,
}
`,
  },
  'state.rs': {
    name: 'state.rs',
    language: 'rust',
    content: `use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub amount: u64,
    pub owner: Pubkey,
    pub bump: u8,
}
`,
  },
  'errors.rs': {
    name: 'errors.rs',
    language: 'rust',
    content: `use anchor_lang::prelude::*;

#[error_code]
pub enum StakingError {
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Unauthorized")]
    Unauthorized,
}
`,
  },
  'Cargo.toml': {
    name: 'Cargo.toml',
    language: 'toml',
    content: `[package]
name = "staking-contract"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.29.0"
curve25519-dalek = "3.2.0"
solana-program = "1.16.0"
`,
  },
};

export const AppProvider = ({ children }) => {
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [activeFile, setActiveFile] = useState('lib.rs');
  const [findings, setFindings] = useState([]);
  const [scanStatus, setScanStatus] = useState('idle'); // idle | running | done
  const [scanProgress, setScanProgress] = useState(0);
  const [toolResults, setToolResults] = useState({
    'cargo-audit': { status: 'idle', message: '' },
    'cargo-geiger': { status: 'idle', message: '' },
    'clippy': { status: 'idle', message: '' },
    'aderyn': { status: 'idle', message: '' },
  });
  const [lastScanAt, setLastScanAt] = useState(null);

  const updateFileContent = useCallback((filename, content) => {
    setFiles(prev => ({
      ...prev,
      [filename]: { ...prev[filename], content },
    }));
  }, []);

  const createFile = useCallback((name) => {
    const isRust = name.endsWith('.rs');
    const isToml = name.endsWith('.toml');
    const language = isRust ? 'rust' : isToml ? 'toml' : 'plaintext';
    setFiles(prev => ({
      ...prev,
      [name]: { name, language, content: '' },
    }));
    setActiveFile(name);
  }, []);

  const deleteFile = useCallback((name) => {
    setFiles(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setActiveFile(prev => (prev === name ? Object.keys(files)[0] : prev));
  }, [files]);

  const importFiles = useCallback((importedFiles) => {
    setFiles(prev => ({ ...prev, ...importedFiles }));
  }, []);

  // Simulated multi-tool scan pipeline
  const runScan = useCallback(async () => {
    if (scanStatus === 'running') return;
    setScanStatus('running');
    setScanProgress(0);
    setFindings([]);
    const reset = {
      'cargo-audit': { status: 'running', message: 'Checking advisories…' },
      'cargo-geiger': { status: 'idle', message: '' },
      'clippy': { status: 'idle', message: '' },
      'aderyn': { status: 'idle', message: '' },
    };
    setToolResults(reset);

    // Analyze all file contents right now
    const allFindings = [];
    for (const [, file] of Object.entries(files)) {
      const fileFindings = analyzeCode(file.content, file.name, file.language);
      allFindings.push(...fileFindings);
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Tool 1 — cargo-audit (dep checks)
    await delay(900);
    setScanProgress(25);
    const auditFindings = allFindings.filter(f => f.tool === 'cargo-audit');
    setToolResults(prev => ({
      ...prev,
      'cargo-audit': {
        status: 'done',
        message: auditFindings.length > 0 ? `${auditFindings.length} advisor${auditFindings.length > 1 ? 'ies' : 'y'}` : 'Clean',
      },
      'cargo-geiger': { status: 'running', message: 'Scanning unsafe blocks…' },
    }));

    // Tool 2 — cargo-geiger
    await delay(900);
    setScanProgress(50);
    const geigerFindings = allFindings.filter(f => f.tool === 'cargo-geiger');
    setToolResults(prev => ({
      ...prev,
      'cargo-geiger': {
        status: 'done',
        message: geigerFindings.length > 0 ? `${geigerFindings.length} unsafe block(s)` : '0 unsafe',
      },
      'clippy': { status: 'running', message: 'Linting…' },
    }));

    // Tool 3 — Clippy
    await delay(900);
    setScanProgress(75);
    const clippyFindings = allFindings.filter(f => f.tool === 'clippy');
    setToolResults(prev => ({
      ...prev,
      'clippy': {
        status: 'done',
        message: clippyFindings.length > 0 ? `${clippyFindings.length} lint(s)` : 'Clean',
      },
      'aderyn': { status: 'running', message: 'Running SAST…' },
    }));

    // Tool 4 — Aderyn SAST
    await delay(900);
    setScanProgress(100);
    const aderynFindings = allFindings.filter(f => f.tool === 'aderyn');
    setToolResults(prev => ({
      ...prev,
      'aderyn': {
        status: 'done',
        message: aderynFindings.length > 0 ? `${aderynFindings.length} issue(s)` : 'Clean',
      },
    }));

    setFindings(allFindings);
    setScanStatus('done');
    setLastScanAt(new Date());
  }, [files, scanStatus]);

  const value = {
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
    runScan,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
