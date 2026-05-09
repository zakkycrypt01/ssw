const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { normalizeFiles, summarize } = require('./analyzer');
const { parseToolOutputs } = require('./toolParsers');

const DEFAULT_IMAGE = 'ssw-scanner:1.0.0';
const DOCKER_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS || 600_000); // 10 min — Anchor has ~200 deps
const CARGO_CACHE_VOLUME = process.env.SSW_CARGO_CACHE_VOLUME || 'ssw-cargo-cache';

async function writeProject(workspace, files) {
  for (const file of files) {
    const target = path.join(workspace, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }

  const cargoToml = path.join(workspace, 'Cargo.toml');
  try {
    await fs.access(cargoToml);
  } catch {
    await fs.writeFile(cargoToml, '[workspace]\nmembers = []\n', 'utf8');
  }
}

function runDocker({ workspace, outputDir, image, timeoutMs }) {
  const args = [
    'run',
    '--rm',
    '--cpus', process.env.SCAN_CPUS || '2',
    '--memory', process.env.SCAN_MEMORY || '4g',
    '--pids-limit', process.env.SCAN_PIDS_LIMIT || '512',
    '--security-opt', 'no-new-privileges',
    '--cap-drop', 'ALL',
    // CARGO_HOME: persistent named volume — deps downloaded once, reused every scan
    '-v', `${CARGO_CACHE_VOLUME}:/usr/local/cargo/registry`,
    // CARGO_TARGET_DIR: per-scan tmpfs with exec so build scripts can run
    '--tmpfs', '/tmp/cargo-target:rw,exec,nosuid,size=3g',
    // General /tmp scratch
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m',
    '-e', 'CARGO_TARGET_DIR=/tmp/cargo-target',
    '-v', `${workspace}:/scan:rw`,
    '-v', `${outputDir}:/out:rw`,
    '-w', '/scan',
    image,
    '/usr/local/bin/ssw-scan.sh',
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error(`Docker scan timed out after ${timeoutMs}ms`), { statusCode: 504 }));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`Unable to start Docker scanner: ${error.message}`), { statusCode: 503 }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(Object.assign(new Error(`Docker scanner failed with exit code ${code}: ${stderr || stdout}`), { statusCode: 502 }));
    });
  });
}

async function readOutputJson(outputDir) {
  const raw = await fs.readFile(path.join(outputDir, 'ssw-results.json'), 'utf8');
  return JSON.parse(raw);
}

async function runDockerScan({ projectName, files, startedAt, scanId }) {
  const normalizedFiles = normalizeFiles(files);
  const scanTmpRoot = process.env.SSW_SCAN_TMP_DIR || path.join(process.cwd(), '.scanner-work');
  await fs.mkdir(scanTmpRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(scanTmpRoot, 'ssw-scan-'));
  const workspace = path.join(root, 'workspace');
  const outputDir = path.join(root, 'out');

  await fs.mkdir(workspace, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  try {
    await writeProject(workspace, normalizedFiles);
    const image = process.env.SSW_SCANNER_IMAGE || DEFAULT_IMAGE;
    await runDocker({
      workspace,
      outputDir,
      image,
      timeoutMs: DOCKER_TIMEOUT_MS,
    });

    const toolOutputs = await readOutputJson(outputDir);

    // ── Per-tool diagnostic logs ──────────────────────────────────────────────
    const TOOLS = ['cargo-audit', 'cargo-geiger', 'clippy', 'solana-fender'];
    for (const tool of TOOLS) {
      const t = toolOutputs[tool] || {};
      const exitCode = t.status;
      const stdout = (t.stdout || '').trim();
      const stderr = (t.stderr || '').trim();

      console.log(`\n┌─── [${tool}] exit code: ${exitCode} ${'─'.repeat(Math.max(0, 48 - tool.length))}`);

      if (stderr) {
        const preview = stderr.length > 3000 ? stderr.slice(0, 3000) + '\n… (truncated)' : stderr;
        console.log(`│ STDERR:\n${preview.split('\n').map(l => `│  ${l}`).join('\n')}`);
      }
      if (stdout && tool !== 'solana-fender') {
        const preview = stdout.length > 2000 ? stdout.slice(0, 2000) + '\n… (truncated)' : stdout;
        console.log(`│ STDOUT:\n${preview.split('\n').map(l => `│  ${l}`).join('\n')}`);
      }
      if (tool === 'solana-fender' && stdout) {
        try {
          const parsed = JSON.parse(stdout);
          const count = (parsed.issues || parsed.findings || parsed.detectors || []).length;
          console.log(`│ solana-fender report parsed OK — ${count} issue(s) found`);
        } catch {
          console.log(`│ solana-fender report could not be parsed as JSON`);
          console.log(`│ Raw preview: ${stdout.slice(0, 500)}`);
        }
      }
      console.log(`└${'─'.repeat(55)}`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const findings = parseToolOutputs(toolOutputs);

    return {
      findings,
      summary: summarize(findings),
      metadata: {
        scan_id: scanId,
        project_name: projectName,
        scanned_at: startedAt.toISOString(),
        engine: 'ssw-docker-toolchain',
        engine_version: '1.0.0',
        scanner_image: image,
        sandbox: {
          docker: true,
          network: 'none',
          read_only_rootfs: true,
          no_new_privileges: true,
          cap_drop: 'ALL',
        },
        tool_versions: toolOutputs.versions || {},
        tool_exit_codes: Object.fromEntries(Object.entries(toolOutputs).filter(([, value]) => value && typeof value === 'object' && 'status' in value).map(([tool, value]) => [tool, value.status])),
        files_scanned: normalizedFiles.length,
      },
    };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

module.exports = { runDockerScan };
