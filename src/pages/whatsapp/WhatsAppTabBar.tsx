/**
 * WhatsAppTabBar — the WhatsAppPage tab strip + the refresh button on the same
 * line, extracted verbatim (pure split, no behaviour change) from
 * WhatsAppPage's inline tab bar JSX.
 */
import { RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'

export type WhatsAppTabId = 'overview' | 'messages' | 'queue' | 'escalations' | 'wa-web-queue' | 'conversations'

export default function WhatsAppTabBar({
  tab, setTab, escalationsCount, tabs, refreshing, onRefresh, refreshLabel,
}: {
  tab: WhatsAppTabId
  setTab: (id: WhatsAppTabId) => void
  escalationsCount: number
  // Ordered [id, label] pairs — built by the caller so translations/gating stay in the page.
  tabs: readonly (readonly [WhatsAppTabId, string])[]
  refreshing: boolean
  onRefresh: () => void
  refreshLabel: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
      <div role="tablist" style={{ display: 'flex', gap: 4 }}>
        {tabs.map(([id, label]) => {
          const active = id === tab
          // Only the escalations tab ever carries a badge — always the danger tint.
          const badge = id === 'escalations' ? escalationsCount : 0
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- role="tab" NAVIGATIE-face (rustende tab = plaatsmarkering, PRIMAIR-VLAK-1): underline-actief, geen actieknop; Button modelleert geen tabblad
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
                // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                color: active ? 'var(--color-primary-text)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {label}
              {badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 5px', borderRadius: 99,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--color-danger)',
                  /* Text colour on the danger badge fill uses the on-* contrast token, never raw white */
                  color: 'var(--color-on-danger)' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <Button variant="primary" size="sm" onClick={onRefresh} disabled={refreshing}
        style={{ marginBottom: 6 }}>
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} /> {refreshLabel}
      </Button>
    </div>
  )
}
