/**
 * DrawerTabs — the tab bar inside an EntityDrawer. Pure presentational; the
 * drawer owns the active state. Reused by every entity drawer.
 */
import type { ReactNode } from 'react'

export interface DrawerTabItem { id: string; label: ReactNode; badge?: string | number }

export default function DrawerTabs({ tabs = [], active, onChange }: {
  tabs?: DrawerTabItem[]
  active?: string
  onChange: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', overflowX: 'auto', gap: 0, marginBottom: -1 }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          style={{ padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap', background: 'none', border: 'none',
            borderBottom: active === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: active === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
            fontWeight: active === tab.id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
          {tab.label}{tab.badge != null ? ` ${tab.badge}` : ''}
        </button>
      ))}
    </div>
  )
}
