/**
 * OpenCheckGroup — an always-visible checkbox list for a SMALL fixed lookup
 * (phase/status/funnel/contract form/gender). One click per filter instead of
 * open-dropdown-then-click; shows the lookup colour as a soft dot + the count.
 */
import type { ReportFilterGroup } from '@/types/reports'

export default function OpenCheckGroup({ group }: { group: ReportFilterGroup }) {
  const options  = group.options  ?? []
  const selected = group.selected ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {options.map(opt => {
        const checked = selected.includes(opt.value)
        return (
          <label key={opt.value}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 6px',
                     borderRadius: 6, cursor: 'pointer',
                     background: checked ? 'var(--color-primary-bg)' : 'transparent' }}
            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}>
            <input type="checkbox" checked={checked} onChange={() => group.onToggle?.(opt.value)}
              style={{ accentColor: 'var(--color-primary)', width: 12, height: 12, flexShrink: 0 }} />
            {/* Soft colour dot for semantic lookups (status/funnel/…). */}
            {opt.color && (
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                background: `color-mix(in srgb, ${opt.color} 85%, transparent)`,
                border: `1px solid ${opt.color}` }} />
            )}
            <span style={{ flex: 1, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap', color: checked ? 'var(--color-primary)' : 'var(--text)',
                           fontWeight: checked ? 500 : 400 }}>
              {opt.label}
            </span>
            {opt.count != null && (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {opt.count}
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}
