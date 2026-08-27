/**
 * SegmentBars — the ONE calm horizontal-bar renderer shared by every inflow report
 * (candidates · applications · customers, RAPPORTEN-SUITE-1). Extracted so the
 * orphan-value handling below applies retroactively to all three: a segment whose
 * lookup row was deleted still arrives from the backend as a normal array entry
 * (its own label, e.g. "Onbekend (verwijderde status)", summed into total) — this
 * component needs no special-casing for that, it just renders whatever label/value
 * the payload sends and drills on the raw value, exactly like any other segment.
 */
import type { CSSProperties } from 'react'

export interface SegmentBarItem {
  key: string
  label: string
  count: number
  color: string | null
  // Optional muted caption under the label (e.g. "waarvan 5 direct ingestroomd") —
  // rendered only when present, so rows without one keep their single-line height.
  sub?: string
}

// The one shared horizontal-bar renderer for every inflow report (see file
// docblock above) — renders exactly whatever label/value each segment carries,
// including an orphaned-lookup row, with no special-casing.
export default function SegmentBars({ items, max, onPick }: {
  items: SegmentBarItem[]
  max: number
  onPick?: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
      {items.map((it) => {
        const tint = it.color ?? 'var(--color-primary)'
        const clickable = !!onPick
        return (
          <div key={it.key}
               onClick={clickable ? () => onPick(it.key) : undefined}
               role={clickable ? 'button' : undefined}
               tabIndex={clickable ? 0 : undefined}
               onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(it.key) } } : undefined}
               style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: clickable ? 'pointer' : 'default' }}>
            <span style={{ flex: '0 0 34%', minWidth: 0 } as CSSProperties}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text)', overflow: 'hidden',
                             textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties}>{it.label}</span>
              {it.sub && (
                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden',
                               textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties}>{it.sub}</span>
              )}
            </span>
            <span style={{ flex: 1, height: 8, background: 'var(--hover-bg)', borderRadius: 999, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${max > 0 ? (it.count / max) * 100 : 0}%`,
                             background: `color-mix(in srgb, ${tint} 70%, transparent)`, borderRadius: 999 }} />
            </span>
            <span style={{ flex: '0 0 40px', textAlign: 'right', fontSize: 12, fontWeight: 600,
                           fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{it.count}</span>
          </div>
        )
      })}
    </div>
  )
}
