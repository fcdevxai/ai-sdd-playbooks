/**
 * Tiny semver range check for the methodology compatibility range (C-08).
 * Supports the space-separated comparator form we emit, e.g. ">=2.0.0 <3.0.0".
 * Not a full semver implementation — just enough for compatibility gating.
 */
function parse(v) {
  return String(v).split('.').map((n) => parseInt(n, 10) || 0);
}

export function compare(a, b) {
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < 3; i++) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function satisfies(version, range) {
  if (!range) return true;
  return String(range).trim().split(/\s+/).every((part) => {
    const m = part.match(/^(>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+)$/);
    if (!m) return true; // ignore tokens we don't understand
    const op = m[1] || '=';
    const c = compare(version, m[2]);
    switch (op) {
      case '>=': return c >= 0;
      case '<=': return c <= 0;
      case '>': return c > 0;
      case '<': return c < 0;
      default: return c === 0;
    }
  });
}
