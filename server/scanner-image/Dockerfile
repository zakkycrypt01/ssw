FROM rust:1.85-slim-bookworm

ENV CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    PATH="/usr/local/cargo/bin:$PATH"

# ── System deps ────────────────────────────────────────────────────────────────
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates pkg-config libssl-dev git curl build-essential nodejs \
  && rm -rf /var/lib/apt/lists/*

# ── Rust toolchain ─────────────────────────────────────────────────────────────
RUN rustup component add clippy

# ── Security tools ─────────────────────────────────────────────────────────────
RUN cargo install cargo-audit --locked
RUN cargo install cargo-geiger --locked
RUN cargo install solana_fender --locked

# ── Pre-bake RustSec advisory DB (no network needed at scan time) ──────────────
RUN git clone --depth 1 https://github.com/RustSec/advisory-db /usr/local/rustsec/advisory-db

# ── Pre-populate Cargo registry with Anchor + Solana crates ───────────────────
# Build a throwaway workspace so all deps are cached in CARGO_HOME/registry.
# Scan containers run with --network none, so everything must be pre-fetched.
WORKDIR /tmp/anchor-prefetch
RUN cat > Cargo.toml <<'EOF'
[package]
name = "anchor-prefetch"
version = "0.1.0"
edition = "2021"

[lib]
name = "anchor_prefetch"
path = "src/lib.rs"

[dependencies]
anchor-lang = "0.29.0"
anchor-spl  = "0.29.0"
solana-program = "1.18"
spl-token = "4.0"
spl-associated-token-account = "2.3"
curve25519-dalek = "3.2.0"
EOF
RUN mkdir -p src && echo 'fn _dummy() {}' > src/lib.rs
# Download all source tarballs into the registry cache
RUN cargo fetch
# Compile once to warm the incremental cache (speeds up scan-time clippy)
RUN cargo build 2>/dev/null || true
RUN cargo clippy --message-format=json 2>/dev/null || true
WORKDIR /

# ── Strip build tools we no longer need ───────────────────────────────────────
RUN apt-get purge -y git curl build-essential \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/* /tmp/anchor-prefetch

# ── Scanner scripts ────────────────────────────────────────────────────────────
COPY ssw-scan.sh /usr/local/bin/ssw-scan.sh
COPY ssw-collect.js /usr/local/bin/ssw-collect.js
RUN chmod +x /usr/local/bin/ssw-scan.sh

WORKDIR /scan
