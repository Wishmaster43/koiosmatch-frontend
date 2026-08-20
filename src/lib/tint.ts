/**
 * tint — THE §4 soft-tint formula, as one function instead of four competing
 * percentage pairs (HUISSTIJL-1, measured 18-08: QuickViewToggle used 8/16+28/50,
 * SoftChip 10/33, softPill 14/45, ChipMultiSelect 16/50 — all claiming to be "the
 * §4 recipe"). color-mix, never hex-concatenation: `color + '1A'` silently breaks
 * the moment a CSS-var token is passed, which is exactly how tenant-branded
 * surfaces lost their tint. The constants are the ONE house pair; passing an
 * ad-hoc percentage elsewhere is a finding.
 */
export const TINT_BG = 10
export const TINT_BG_ACTIVE = 16
export const TINT_BORDER = 33
export const TINT_BORDER_ACTIVE = 50

// A translucent tint of `color` at `pct` percent — works for hex AND var() tokens.
export const tint = (color: string, pct: number): string =>
  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- THE canonical tint formula the rule steers everyone toward, not a copy of it
  `color-mix(in srgb, ${color} ${pct}%, transparent)`

// The four house surfaces, named so call sites read as intent, not as numbers.
export const tintBg = (color: string, active = false): string =>
  tint(color, active ? TINT_BG_ACTIVE : TINT_BG)
export const tintBorder = (color: string, active = false): string =>
  `1px solid ${tint(color, active ? TINT_BORDER_ACTIVE : TINT_BORDER)}`

// Share of the colour kept in chip TEXT; the rest comes from --text. Measured
// (herhaal-slotaudit 20-08) over every semantic token, the grey fallback and the
// accent, on the 10% AND 16% tints over --bg and --surface, in BOTH themes:
// 45% is the highest share that clears WCAG 4.5:1 everywhere (light worst 5.38,
// dark worst 6.67 — 60%, the old QuickViewToggle recipe, failed accent at 3.75).
export const TINT_INK = 45

// The ONE ink for text sitting on its own tint (chips, pills, soft variants).
// The raw colour itself reads 2.4-3.0:1 there — the herhaal-slotaudit measured
// every non-primary SoftChip failing AA. Mixing toward --text is theme-aware
// (darkens in light mode, lightens in dark) and works for lookup hexes and
// var() tokens alike. Primary keeps its tuned tenant-aware twin.
export const chipInk = (color: string): string =>
  color === 'var(--color-primary)'
    ? 'var(--color-primary-text)'
    : `color-mix(in srgb, ${color} ${TINT_INK}%, var(--text))`
