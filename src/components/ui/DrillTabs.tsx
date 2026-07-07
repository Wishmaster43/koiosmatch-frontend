/**
 * DrillTabs — the ONE pill-tab switcher for drill-down drawers (candidate buckets,
 * shift series, …). Every option stays visible with an optional count badge;
 * active = primary tint + 600. Standardises what used to be chips in one drawer
 * and a dropdown in the other (Danny: "PLAN EEN STANDAARD").
 */
import type { ReactNode } from 'react'

export interface DrillTab { key: string; label: ReactNode; count?: number }

export default function DrillTabs({ tabs, active, onChange }: {
  tabs: DrillTab[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tabs.map(tb => {
        const on = tb.key === active
        return (
          <button key={tb.key} type="button" onClick={() => onChange(tb.key)} aria-pressed={on}
            style={{ padding: '4px 10px', fontSize: 12, fontWeight: on ? 600 : 400, borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`,
              background: on ? 'var(--color-primary-bg)' : 'var(--surface)',
              color: on ? 'var(--color-primary)' : 'var(--text-muted)' }}>
            {tb.label}
            {tb.count != null && <span style={{ opacity: 0.7, marginLeft: 4 }}>{tb.count.toLocaleString('nl-NL')}</span>}
          </button>
        )
      })}
    </div>
  )
}
