// Small deterministic RNG (mulberry32) plus helpers. The game reseeds from
// the clock for real play; screenshot poses reseed to a fixed value so a
// posed frame is the same every time it is taken.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(lo, hi) {
      return lo + next() * (hi - lo);
    },
    int(lo, hi) {
      return Math.floor(this.range(lo, hi + 1));
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // Weighted pick: entries are [value, weight].
    weighted(entries) {
      let total = 0;
      for (const [, w] of entries) total += w;
      let r = next() * total;
      for (const [v, w] of entries) {
        r -= w;
        if (r <= 0) return v;
      }
      return entries[entries.length - 1][0];
    },
  };
}
