#!/usr/bin/env bash
set -u

mkdir -p /out

# Wraps a tool: captures stdout/stderr, writes exit code to /out/<name>.status
# TOOL_TIMEOUT_SECONDS defaults to 300s (5 min) — Anchor compilation takes time
run_tool() {
  local name="$1"
  shift

  set +e
  timeout "${TOOL_TIMEOUT_SECONDS:-300}" "$@" >"/out/${name}.stdout" 2>"/out/${name}.stderr"
  local status=$?
  set -e

  printf '%s' "$status" >"/out/${name}.status"
}

set -e

if [ ! -f Cargo.toml ]; then
  for tool in cargo-audit cargo-geiger clippy solana-fender; do
    printf 'Cargo.toml not found\n' > "/out/${tool}.stderr"
    printf '2' > "/out/${tool}.status"
  done
  node /usr/local/bin/ssw-collect.js
  exit 0
fi

# ── cargo-audit ────────────────────────────────────────────────────────────────
# Runs against the advisory-db baked into the image; --no-fetch keeps it offline
run_tool cargo-audit \
  cargo audit --json \
  --no-fetch \
  --db /usr/local/rustsec/advisory-db

# ── Fetch/update lockfile (online, network is now enabled) ─────────────────────
# This resolves any missing deps before the tools that need compilation run
cargo generate-lockfile 2>/out/lockfile.stderr || true

# ── cargo-geiger ───────────────────────────────────────────────────────────────
# Scans for unsafe {} blocks in the dependency tree.
# No --offline: needs to download deps on first run (cached to the volume)
run_tool cargo-geiger \
  cargo geiger --all-features --output-format Json

# ── clippy ─────────────────────────────────────────────────────────────────────
# Lints Anchor programs; warns on arithmetic, unwrap, panic, and expect usage.
# No --offline for same reason as geiger.
run_tool clippy \
  cargo clippy \
  --message-format=json \
  --all-targets \
  --all-features \
  -- \
  -W clippy::arithmetic_side_effects \
  -W clippy::unwrap_used \
  -W clippy::expect_used \
  -W clippy::panic

# ── solana-fender ──────────────────────────────────────────────────────────────
# Runs Solana/Anchor-specific SAST checks:
#   owner_check, signer_check, CPI safety, PDA bump canonicalization, etc.
run_tool solana-fender \
  solana_fender --program /scan

node /usr/local/bin/ssw-collect.js
