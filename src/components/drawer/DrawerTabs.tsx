/**
 * DrawerTabs — the tab bar inside an EntityDrawer. Pure presentational; the
 * drawer owns the active state. Reused by every entity drawer. Same tablist
 * keyboard model as SubTabBar (§6, via the shared useRovingTabs hook) — two
 * tab strips in one product must not expose two different keyboard models.
 */
import type { ReactNode } from 'react'
import { useRovingTabs } from '@/hooks/useRovingTabs'

export interface DrawerTabItem { id: string; label: ReactNode; badge?: string | number }

// A badge never renders for an empty count — undefined/null/0/'0' all hide it (SCHERMWAARHEID-1).
const hasBadge = (badge: DrawerTabItem['badge']): boolean =>
  badge != null && badge !== 0 && badge !== '0'

// The tab strip itself: renders each tab as a roving-tabindex button, active state driven entirely by the caller.
export default function DrawerTabs({ tabs = [], active, onChange }: {
  tabs?: DrawerTabItem[]
  active?: string
  onChange: (id: string) => void
}) {
  // Shared roving-tabindex + arrow/Home/End keyboard model (see the hook doc).
  const { getRef, onKeyDown, tabIndexFor } = useRovingTabs({ ids: tabs.map(t => t.id), active, onChange })

  return (
    <div role="tablist" onKeyDown={onKeyDown} style={{ display: 'flex', overflowX: 'auto', gap: 0, marginBottom: -1 }}>
      {tabs.map(tab => (
        <button key={tab.id} ref={getRef(tab.id)} role="tab" aria-selected={active === tab.id}
          tabIndex={tabIndexFor(tab.id)} onClick={() => onChange(tab.id)}
          style={{ padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap', background: 'none', border: 'none',
            borderBottom: active === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            // Active tab text uses the text-contrast token, not the raw brand color (readability on tinted primaries).
            color: active === tab.id ? 'var(--color-primary-text)' : 'var(--text-muted)',
            fontWeight: active === tab.id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
          {tab.label}{hasBadge(tab.badge) ? ` ${tab.badge}` : ''}
        </button>
      ))}
    </div>
  )
}
