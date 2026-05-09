const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFiles, summarize } = require('../scanner/analyzer');
const { parseToolOutputs } = require('../scanner/toolParsers');

test('parses normalized findings from real scanner tool outputs', () => {
  const findings = parseToolOutputs({
    'cargo-audit': {
      status: 1,
      stdout: JSON.stringify({
        vulnerabilities: {
          list: [
            {
              advisory: {
                id: 'RUSTSEC-0000-0000',
                title: 'test advisory',
                description: 'dependency issue',
                cvss: 8,
              },
              package: { name: 'bad-crate' },
              versions: { patched: ['1.2.3'] },
            },
          ],
        },
      }),
      stderr: '',
    },
    clippy: {
      status: 0,
      stdout: JSON.stringify({
        reason: 'compiler-message',
        message: {
          level: 'warning',
          message: 'use of unwrap',
          code: { code: 'clippy::unwrap_used' },
          spans: [{ is_primary: true, file_name: 'src/lib.rs', line_start: 7 }],
          children: [{ level: 'help', message: 'return a Result instead' }],
        },
      }),
      stderr: '',
    },
    'cargo-geiger': {
      status: 0,
      stdout: '! src/lib.rs 1/1 unsafe expressions found',
      stderr: '',
    },
    aderyn: {
      status: 0,
      stdout: JSON.stringify({
        issues: [
          {
            id: 'ADR-1',
            severity: 'critical',
            title: 'missing owner',
            description: 'owner not checked',
            location: { file: 'src/lib.rs', line: 3 },
            remediation: 'add owner constraint',
          },
        ],
      }),
      stderr: '',
    },
  });

  assert.equal(findings.length, 4);
  assert.equal(findings[0].severity, 'critical');
  assert.ok(findings.every((finding) => finding.tool_source && finding.severity && finding.remediation));
});

test('does not treat cargo-geiger legend text as unsafe usage', () => {
  const findings = parseToolOutputs({
    'cargo-geiger': {
      status: 0,
      stdout: `
Metric output format: x/y
Symbols: ! = No unsafe usage found, ? = Missing #![forbid(unsafe_code)]
src/lib.rs 0/0 0/0 0/0
`,
      stderr: '',
    },
  });

  assert.equal(findings.length, 0);
});

test('deduplicates repeated tool findings', () => {
  const clippyMessage = JSON.stringify({
    reason: 'compiler-message',
    message: {
      level: 'warning',
      message: 'used unwrap() on an Option value',
      code: { code: 'clippy::unwrap_used' },
      spans: [{ is_primary: true, file_name: 'src/lib.rs', line_start: 1 }],
      children: [],
    },
  });
  const findings = parseToolOutputs({
    clippy: {
      status: 0,
      stdout: clippyMessage,
      stderr: clippyMessage,
    },
  });

  assert.equal(findings.length, 1);
});

test('rejects unsafe file paths before writing scan workspace', () => {
  assert.throws(
    () => normalizeFiles([{ path: '../Cargo.toml', content: '' }]),
    /safe relative path/
  );
});

test('accepts safe relative source paths', () => {
  assert.deepEqual(
    normalizeFiles([{ path: 'programs/staking/src/lib.rs', content: 'pub mod staking;' }]),
    [{ path: 'programs/staking/src/lib.rs', content: 'pub mod staking;' }]
  );
});

test('summarize groups findings by severity and tool', () => {
  const summary = summarize([
    { severity: 'critical', tool_source: 'aderyn' },
    { severity: 'high', tool_source: 'cargo-audit' },
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.critical, 1);
  assert.equal(summary.by_tool.aderyn, 1);
});
