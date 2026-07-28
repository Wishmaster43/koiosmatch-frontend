/**
 * SubTabBar — the underline sub-tab strip used INSIDE a drawer tab (Planning,
 * Communication, …). One shared look (§4): active = primary underline + 600
 * weight. Purely presentational; the host owns the active-tab state. Full
 * tablist keyboard model (arrow/Home/End + roving tabindex) comes from the
 * shared useRovingTabs hook — identical to DrawerTabs so both strips behave
 * the same for a keyboard/screen-reader user (§6).
 */
import type { ReactNode } from 'react'
import { useRovingTabs } from '@/hooks/useRovingTabs'

export interface SubTab { id: string; label: ReactNode }

export default function SubTabBar({ tabs, active, onChange }: { tabs: SubTab[]; active: string; onChange: (id: string) => void }) {
  // Shared roving-tabindex + arrow/Home/End keyboard model (see the hook doc).
  const { getRef, onKeyDown, tabIndexFor } = useRovingTabs({ ids: tabs.map(t => t.id), active, onChange })

  return (
    <div role="tablist" className="no-scrollbar" onKeyDown={onKeyDown}
      style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 4, overflowX: 'auto' }}>
      {tabs.map(sub => (
        <button key={sub.id} ref={getRef(sub.id)} role="tab" aria-selected={active === sub.id}
          tabIndex={tabIndexFor(sub.id)} onClick={() => onChange(sub.id)}
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
