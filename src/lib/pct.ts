/**
 * largestRemainderPct — round a set of weights into integer percentages that ALWAYS
 * sum to exactly 100 (Hamilton / largest-remainder method). Plain per-value rounding
 * doesn't: six equal weights each round to 17% → 102% (Danny 22-07). We floor every
 * share, then hand the leftover whole points to the largest fractional remainders.
 */
export function largestRemainderPct(values: number[]): number[] {
  const sum = values.reduce((s, v) => s + v, 0)
  if (sum <= 0) return values.map(() => 0)
  const exact = values.map(v => (v / sum) * 100)
  const out = exact.map(Math.floor)
  let rest = 100 - out.reduce((s, n) => s + n, 0)
  // Distribute the remaining whole points to the largest fractional parts first.
  exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => { if (rest > 0) { out[i]++; rest-- } })
  return out
}
