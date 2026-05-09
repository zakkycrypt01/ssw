class FixedWindowRateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clients = new Map();
  }

  check(key) {
    const now = Date.now();
    const current = this.clients.get(key);

    if (!current || now >= current.resetAt) {
      const resetAt = now + this.windowMs;
      this.clients.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.limit - 1, resetAt };
    }

    if (current.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    return { allowed: true, remaining: this.limit - current.count, resetAt: current.resetAt };
  }
}

module.exports = { FixedWindowRateLimiter };
