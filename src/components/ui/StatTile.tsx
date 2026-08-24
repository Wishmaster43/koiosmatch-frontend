import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { interactive } from '@/lib/a11y'
import { Caption, Mono } from '@/components/ui/typography'

/**
 * StatTile — the ONE small metric tile (klus c, Tile-unificatie): a label plus a
 * bold numeric value in a bordered card. Replaces the four hand-rolled copies
 * that had drifted apart (usageCardStyles.Tile, TenantUsageSettings.Tile,
 * ShiftsSummary.Tile, MatchesReport.StatTile). Identity lives here once:
 * surface + border card, Caption label, Mono 700 value (§1: numbers are
 * JetBrains Mono). Layout (flex/minWidth) rides the style prop; identity never.
 */
interface StatTileProps {
  label: ReactNode
  value: ReactNode
  // Value size: sm = dense usage rows (18), md = dashboard/report tiles (22).
  size?: 'sm' | 'md'
  // Usage face: label above the value; default is value-first (dashboard face).
  labelFirst?: boolean
  // Small colour dot beside the label (data colour, e.g. shift buckets).
  dotColor?: string
  // Value in the accent TEXT token (contrast-safe twin, never the raw brand).
  accent?: boolean
  // Toggle-selected state (clickable tiles only): emits aria-pressed AND a
  // visible check marker — colour is never the only signal (§6; mirrors
  // QuickViewToggle/ChipMultiSelect's chosen convention).
  pressed?: boolean
  onClick?: () => void
  style?: CSSProperties
}

export default function StatTile({ label, value, size = 'md', labelFirst = false, dotColor, accent, pressed, onClick, style }: StatTileProps) {
  // Label row — Caption identity; the optional dot is a data marker, not decoration.
  const labelRow = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {dotColor && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />}
      <Caption>{label}</Caption>
      {pressed && <Check size={12} aria-hidden="true" style={{ color: 'var(--color-primary-text)', flexShrink: 0 }} />}
    </span>
  )
  // Value — Mono 700; accent rides the contrast-safe text twin.
  const valueRow = (
    <Mono style={{ display: 'block', fontSize: size === 'sm' ? 18 : 22, fontWeight: 700, lineHeight: 1.2,
      fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--color-primary-text)' : 'var(--text)' }}>
      {value}
    </Mono>
  )
  return (
    // A <div> with full button semantics via interactive() when clickable — the
    // block-level content is not valid <button> content (mirrors KpiBlock).
    <div
      style={{ flex: '1 1 0', minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px', cursor: onClick ? 'pointer' : undefined,
        transition: 'background 0.1s', ...style }}
      {...interactive(onClick)}
      {...(onClick && pressed != null ? { 'aria-pressed': pressed } : {})}
      onMouseEnter={onClick ? e => (e.currentTarget.style.background = 'var(--hover-bg)') : undefined}
      onMouseLeave={onClick ? e => (e.currentTarget.style.background = 'var(--surface)') : undefined}
    >
      {labelFirst
        ? <>{labelRow}<span style={{ display: 'block', marginTop: 4 }}>{valueRow}</span></>
        : <>{valueRow}<span style={{ display: 'block', marginTop: 5 }}>{labelRow}</span></>}
    </div>
  )
}
