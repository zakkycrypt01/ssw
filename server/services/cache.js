class TtlCache {
  constructor(ttlMs, maxEntries = 500) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.items = new Map();
  }

  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key, value) {
    if (this.items.size >= this.maxEntries) {
      const oldest = this.items.keys().next().value;
      this.items.delete(oldest);
    }
    this.items.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

module.exports = { TtlCache };
