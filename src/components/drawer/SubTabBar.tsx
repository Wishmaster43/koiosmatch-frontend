/**
 * SubTabBar — the underline sub-tab strip used INSIDE a drawer tab (Planning,
 * Communication, …). One shared look (§4): active = primary underline + 600 weight.
 * Purely presentational; the host owns the active-tab state.
 */
import type { ReactNode } from 'react'

export interface SubTab { id: string; label: ReactNode }

export default function SubTabBar({ tabs, active, onChange }: { tabs: SubTab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 4, overflowX: 'auto' }}>
      {tabs.map(sub => (
        <button key={sub.id} role="tab" aria-selected={active === sub.id} onClick={() => onChange(sub.id)}
          style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap', background: 'none', border: 'none',
            borderBottom: active === sub.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: active === sub.id ? 'var(--color-primary)' : 'var(--text-muted)',
            fontWeight: active === sub.id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
          {sub.label}
        </button>
      ))}
    </div>
  )
}
