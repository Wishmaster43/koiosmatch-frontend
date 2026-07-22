/**
 * largestRemainderPct — round a set of weights into percentages that ALWAYS sum to
 * exactly 100 (Hamilton / largest-remainder method), at the requested decimal
 * precision. Plain per-value rounding doesn't sum to 100 (six equal weights each
 * round to 17% → 102%), and INTEGER shares of a 6-way split can't be both equal AND
 * total 100 (100÷6 = 16,666…). One decimal keeps the values visually equal (16,7 vs
 * 16,6 — a 0,1 gap) while still totalling exactly 100 (Danny 22-07: "de 6 samen 100%").
 * `decimals=0` returns integers; `decimals=1` returns tenths. We floor every share and
 * hand the leftover units to the largest fractional remainders, working in whole
 * 1/scale units so the total is exact regardless of float error.
 */
export function largestRemainderPct(values: number[], decimals = 0): number[] {
  const sum = values.reduce((s, v) => s + v, 0)
  if (sum <= 0) return values.map(() => 0)
  const scale = 10 ** decimals
  const target = 100 * scale
  const exact = values.map(v => (v / sum) * target)
  const out = exact.map(Math.floor)
  let rest = target - out.reduce((s, n) => s + n, 0)
  exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => { if (rest > 0) { out[i]++; rest-- } })
  return out.map(u => u / scale)
}
