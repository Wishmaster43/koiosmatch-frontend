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
  `color-mix(in srgb, ${color} ${pct}%, transparent)`

// The four house surfaces, named so call sites read as intent, not as numbers.
export const tintBg = (color: string, active = false): string =>
  tint(color, active ? TINT_BG_ACTIVE : TINT_BG)
export const tintBorder = (color: string, active = false): string =>
  `1px solid ${tint(color, active ? TINT_BORDER_ACTIVE : TINT_BORDER)}`
