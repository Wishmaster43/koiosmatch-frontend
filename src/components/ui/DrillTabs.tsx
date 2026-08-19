/**
 * DrillTabs — the ONE pill-tab switcher for drill-down drawers (candidate buckets,
 * shift series, …). Every option stays visible with an optional count badge;
 * active = the house button trio, solid, + 600. Standardises what used to be
 * chips in one drawer and a dropdown in the other (Danny: "PLAN EEN STANDAARD").
 */
import type { ReactNode } from 'react'
import { formatNumber } from '@/lib/formatters'

export interface DrillTab { key: string; label: ReactNode; count?: number; title?: string }

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
          <button key={tb.key} type="button" onClick={() => onChange(tb.key)} aria-pressed={on} title={tb.title}
            style={{ padding: '4px 10px', fontSize: 12, fontWeight: on ? 600 : 400, borderRadius: 999, cursor: 'pointer',
              // HUISSTIJL-1: the SELECTED tab reads the house trio, solid; inactive
              // keeps muted text on the calm surface, never a grey fill.
              border: `1px solid ${on ? 'var(--button-border)' : 'var(--border)'}`,
              background: on ? 'var(--button-fill)' : 'var(--surface)',
              color: on ? 'var(--button-ink)' : 'var(--text-muted)' }}>
            {tb.label}
            {tb.count != null && <span style={{ opacity: 0.7, marginLeft: 4 }}>{formatNumber(tb.count)}</span>}
          </button>
        )
      })}
    </div>
  )
}
