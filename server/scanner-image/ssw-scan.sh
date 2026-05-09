#!/usr/bin/env bash
set -u

mkdir -p /out

run_tool() {
  local name="$1"
  shift

  set +e
  timeout "${TOOL_TIMEOUT_SECONDS:-110}" "$@" >"/out/${name}.stdout" 2>"/out/${name}.stderr"
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
# --no-fetch uses the pre-baked advisory-db, no network needed
run_tool cargo-audit \
  cargo audit --json \
  --no-fetch \
  --db /usr/local/rustsec/advisory-db

# ── Fetch missing deps using pre-baked registry ────────────────────────────────
cargo fetch --offline 2>/out/fetch.stderr || true

# ── cargo-geiger ───────────────────────────────────────────────────────────────
run_tool cargo-geiger \
  cargo geiger --offline --all-features --output-format Json

# ── clippy ─────────────────────────────────────────────────────────────────────
run_tool clippy \
  cargo clippy --offline \
  --message-format=json \
  --all-targets \
  --all-features \
  -- \
  -W clippy::integer_arithmetic \
  -W clippy::arithmetic_side_effects \
  -W clippy::unwrap_used \
  -W clippy::expect_used \
  -W clippy::panic

# ── solana-fender ─────────────────────────────────────────────────────────────
# Runs Solana/Anchor-specific SAST checks (owner check, signer check, CPI, etc.)
run_tool solana-fender \
  solana_fender --program /scan

node /usr/local/bin/ssw-collect.js
