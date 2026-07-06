import type { ReactNode } from 'react'

/**
 * SoftChip — THE §3A/§4 soft-chip: a tinted label with a matching border, never a
 * solid fill. Tints use color-mix so both hex values and CSS-var tokens work
 * (hex-concat like `c+'1A'` breaks on var(--…) — the reason three chip styles
 * drifted apart). StatusPill and StatusBadge render through this component, so
 * every entity reads the same chip forever (C-CHIP unification, 2026-07-06).
 */
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
  const c = color ?? '#9CA3AF'
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: size, fontWeight: 500, padding: '2px 8px', borderRadius: round ? 99 : 6,
      background: `color-mix(in srgb, ${c} 10%, transparent)`, color: c,
      border: `1px solid color-mix(in srgb, ${c} 33%, transparent)`, whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />}
      {label}
    </span>
  )
}
