/**
 * SoftChip — THE §3A/§4 soft-chip: a tinted label with a matching border, never a
 * solid fill. Tints use color-mix so both hex values and CSS-var tokens work
 * (hex-concat like `c+'1A'` breaks on var(--…) — the reason three chip styles
 * drifted apart). StatusPill and StatusBadge render through this component, so
 * every entity reads the same chip forever (C-CHIP unification, 2026-07-06).
 */
import type { ReactNode } from 'react'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
interface SoftChipProps {
  label?: ReactNode
  color?: string | null
  /** Optional leading dot (e.g. a priority indicator). */
  dot?: boolean
  title?: string
  /** Fully-rounded pill corners (the StatusPill/StatusBadge look); default 6px. */
  round?: boolean
  /** Font size override (StatusBadge exposes one); default 11. */
  size?: number
}

export default function SoftChip({ label, color, dot = false, title, round = false, size = 11 }: SoftChipProps) {
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice (mirrors Avatar's NEUTRAL_AVATAR / TitleBadge's identical constant)
  const c = color ?? '#9CA3AF'
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: size, fontWeight: 500, padding: '2px 8px', borderRadius: round ? 99 : 6,
      // Ink via chipInk (herhaal-slotaudit 20-08, measured): the raw colour as text
      // on its own tint reads 2.4-3.0:1 for every non-primary token — AA fail. The
      // hue still carries the meaning via dot, border and tint; the TEXT blends
      // toward --text far enough to read (≥5.3:1 both themes).
      background: tintBg(c), color: chipInk(c),
      border: tintBorder(c), whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />}
      {label}
    </span>
  )
}
