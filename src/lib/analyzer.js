/**
 * Client-side static analysis engine.
 * Scans code for common Solana / Anchor / Rust vulnerability patterns.
 * Returns structured Finding objects derived from the actual code content.
 */

let findingIdCounter = 0;
const nextId = (tool) => {
  findingIdCounter++;
  const prefix = { 'aderyn': 'SSW', 'cargo-audit': 'AUD', 'clippy': 'CLY', 'cargo-geiger': 'GEI' }[tool] ?? 'FND';
  return `${prefix}-${String(findingIdCounter).padStart(3, '0')}`;
};

// Reset counter per full scan
export const resetCounter = () => { findingIdCounter = 0; };

/**
 * Pattern-based rules. Each rule has:
 *  - tool: which scanner reports it
 *  - severity: critical | high | medium | low | info
 *  - pattern: RegExp to match against the file content
 *  - title: human-readable finding title
 *  - description: explanation
 *  - remedy: suggested fix
 *  - fileFilter: optional fn(filename) -> bool to scope the rule
 */
const RULES = [
  // ── Aderyn SAST ──────────────────────────────────────────────────────────
  {
    tool: 'aderyn',
    severity: 'critical',
    pattern: /\/\/\s*(todo|fixme|missing).*owner/i,
    title: 'Missing account owner check',
    description: 'An account is used without validating its owner. An attacker can substitute an arbitrary account.',
    remedy: 'Add `constraint = vault.owner == user.key()` or use Anchor `#[account(has_one = owner)]`.',
  },
  {
    tool: 'aderyn',
    severity: 'critical',
    pattern: /pub fn\s+\w+\s*\(ctx:\s*Context<[^>]+>(?!\s*,\s*[^)]*Signer)/,
    title: 'Missing signer check on instruction',
    description: 'Instruction handler accepts a context without requiring a signer, allowing unauthorized invocations.',
    remedy: 'Add a `Signer<\'info>` account to the accounts struct and verify it in the handler.',
  },
  {
    tool: 'aderyn',
    severity: 'high',
    pattern: /\.amount\s*[-+]=\s*\w+(?!.*checked)/,
    title: 'Unchecked arithmetic on account field',
    description: 'Direct arithmetic on an account field without checked/saturating math can overflow or underflow.',
    remedy: 'Use `checked_add`, `checked_sub`, or `saturating_add`/`saturating_sub`.',
  },
  {
    tool: 'aderyn',
    severity: 'medium',
    pattern: /declare_id!\s*\(\s*"[A-Za-z0-9]{43,44}"\s*\)/,
    title: 'Hardcoded program ID',
    description: 'A program ID is hardcoded. Deployments to devnet/mainnet will require manual updates.',
    remedy: 'Use an environment variable or config file to manage program IDs per environment.',
  },
  {
    tool: 'aderyn',
    severity: 'info',
    pattern: /\/\/\s*(todo|fixme|hack|xxx)/i,
    title: 'TODO / FIXME comment found',
    description: 'An incomplete or flagged code comment was found. Ensure it is resolved before production.',
    remedy: 'Address the TODO/FIXME before deployment.',
  },

  // ── Clippy ────────────────────────────────────────────────────────────────
  {
    tool: 'clippy',
    severity: 'medium',
    pattern: /\blet\s+\w+\s*=\s*\w+\s*\*\s*\w+\s*;(?!.*checked)/,
    title: 'Unchecked arithmetic multiplication',
    description: 'An unchecked multiplication can silently overflow, producing incorrect results.',
    remedy: 'Use `checked_mul` or `saturating_mul` and handle the Option/Result.',
  },
  {
    tool: 'clippy',
    severity: 'low',
    pattern: /pub fn\s+\w+[^{]*\{\s*\/\/[^\n]+\n\s*\}/,
    title: 'Empty function body with only a comment',
    description: 'A public function contains only a comment and no implementation.',
    remedy: 'Implement the function or remove it if unused.',
  },
  {
    tool: 'clippy',
    severity: 'medium',
    pattern: /\bu64::MAX\b|\bi64::MIN\b|\bi64::MAX\b/,
    title: 'Use of integer boundary constant without bounds check',
    description: 'Using integer boundaries without explicit boundary validation may cause panics.',
    remedy: 'Add range validation before using boundary constants in arithmetic.',
  },
  {
    tool: 'clippy',
    severity: 'low',
    pattern: /\bunwrap\(\)/,
    title: 'Use of `.unwrap()` — prefer `?` or `expect`',
    description: '`.unwrap()` panics on `None`/`Err`, crashing the program without a meaningful error.',
    remedy: 'Use `?` for error propagation or `.expect("descriptive msg")` for debugging.',
  },

  // ── cargo-audit (dependency vulnerabilities) ──────────────────────────────
  {
    tool: 'cargo-audit',
    severity: 'high',
    pattern: /curve25519-dalek\s*=\s*["']?[0-3]\./,
    title: 'Vulnerable dependency: curve25519-dalek < 4.0',
    description: 'Versions below 4.0 of curve25519-dalek have a timing side-channel vulnerability (RUSTSEC-2024-0012) that can leak private key material.',
    remedy: 'Upgrade to `curve25519-dalek = "4.1"` and audit downstream usages.',
    fileFilter: (f) => f === 'Cargo.toml',
  },
  {
    tool: 'cargo-audit',
    severity: 'medium',
    pattern: /solana-program\s*=\s*["']?1\.1[0-5]\./,
    title: 'Outdated solana-program SDK',
    description: 'Versions 1.10–1.15 of solana-program have known RPC and account-deserialization bugs.',
    remedy: 'Upgrade to solana-program 1.16 or later.',
    fileFilter: (f) => f === 'Cargo.toml',
  },
  {
    tool: 'cargo-audit',
    severity: 'info',
    pattern: /anchor-lang\s*=\s*["']?0\.[12][0-8]\./,
    title: 'Anchor version below 0.29',
    description: 'Older Anchor versions lack important safety checks and IDL improvements.',
    remedy: 'Upgrade to anchor-lang 0.29 or the latest stable release.',
    fileFilter: (f) => f === 'Cargo.toml',
  },

  // ── cargo-geiger (unsafe blocks) ─────────────────────────────────────────
  {
    tool: 'cargo-geiger',
    severity: 'high',
    pattern: /\bunsafe\s*\{/,
    title: 'Unsafe block detected',
    description: 'An `unsafe` block bypasses Rust\'s memory-safety guarantees. Any bug inside can lead to undefined behavior.',
    remedy: 'Eliminate the unsafe block where possible. If unavoidable, add a `// SAFETY:` comment justifying correctness.',
  },
  {
    tool: 'cargo-geiger',
    severity: 'medium',
    pattern: /unsafe\s+fn\s+\w+/,
    title: 'Unsafe function definition',
    description: 'An unsafe function requires every caller to uphold invariants that the compiler cannot verify.',
    remedy: 'Wrap the unsafe function in a safe abstraction where possible.',
  },
];

/**
 * Main analysis entry point.
 * @param {string} content - Source code content
 * @param {string} filename - File name (used for scoping rules)
 * @param {string} language - Language identifier
 * @returns {Finding[]}
 */
export const analyzeCode = (content, filename, language) => {
  if (!content || !content.trim()) return [];

  const findings = [];
  const lines = content.split('\n');

  for (const rule of RULES) {
    if (rule.fileFilter && !rule.fileFilter(filename)) continue;

    // Test globally across the whole file
    const globalMatch = rule.pattern.test(content);
    if (!globalMatch) continue;

    // Find the specific line number
    let lineNumber = null;
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        lineNumber = i + 1;
        break;
      }
    }

    findings.push({
      id: nextId(rule.tool),
      tool: rule.tool,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      remedy: rule.remedy,
      filename,
      lineNumber,
      location: lineNumber ? `${filename}:${lineNumber}` : filename,
    });
  }

  return findings;
};

/** Severity sort order */
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Sort findings by severity then filename */
export const sortFindings = (findings) =>
  [...findings].sort((a, b) => {
    const sd = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    if (sd !== 0) return sd;
    return a.filename.localeCompare(b.filename);
  });

/** Group findings by severity for summary display */
export const summarizeFindings = (findings) => {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
};
