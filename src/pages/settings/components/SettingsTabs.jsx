/**
 * SettingsTabs — the sub-tab strip for the active category. Renders nothing when
 * a category has a single item (no point in a one-tab bar). Active tab carries a
 * primary-coloured underline. SETTINGS-TABS-OVERFLOW-1 (Danny 30-08, "tekst past
 * niet meer op het scherm" — the Super Admin group's 7 tabs clipped at narrower
 * widths): the strip scrolls horizontally (wheel/keyboard/drag all just work via
 * native overflow-x), the active tab is always scrolled into view on
 * mount/change AND on viewport resize (a resize that shrinks the strip must not
 * leave the active tab off-screen with no cue), and a soft edge fade signals
 * there is more to scroll to on either side. Tabs never shrink below their text
 * (whiteSpace nowrap). The overflow/scroll/fade machinery is the shared
 * useTabStripOverflow hook (lifted into SubTabBar too, per the tool-matrix
 * verdict finding 1) — one implementation for every scrolling tab strip.
 */
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useTabStripOverflow } from '@/components/drawer/useTabStripOverflow'

export default function SettingsTabs({ items, active, onSelect }) {
  const { t } = useTranslation('settings')
  const containerRef = useRef(null)
  const activeRef = useRef(null)
  const { edges } = useTabStripOverflow(containerRef, activeRef, active, items.length)

  if (items.length <= 1) return null

  return (
    <div style={{ position: 'relative', marginBottom: 24 }}>
      <div ref={containerRef} role="tablist" className="no-scrollbar" style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', overflowX: 'auto',
      }}>
        {items.map(item => {
          const Icon = item.icon
          const isActive = item.id === active
          return (
            <button key={item.id} ref={isActive ? activeRef : undefined} role="tab" aria-selected={isActive}
              onClick={() => onSelect(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px',
                border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                // Text colour uses the AA-contrast primary-text token, not the raw accent (P2b).
                color: isActive ? 'var(--color-primary-text)' : 'var(--text-muted)',
                borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                marginBottom: -1, transition: 'color 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)' }}>
              {Icon && <Icon size={14} style={{ flexShrink: 0 }} />}
              {t(`nav.${item.id}`)}
            </button>
          )
        })}
      </div>
      {/* Edge fades (tokens only, §4) — a visual "there's more" cue, never blocking clicks. */}
      {edges.left && (
        <div aria-hidden data-testid="settings-tabs-edge-left" style={{
          position: 'absolute', left: 0, top: 0, bottom: 1, width: 28, pointerEvents: 'none',
          // Fades to --bg, the content column's actual (inherited) page background,
          // not --surface (which is the sidebar card colour a few pixels to the left).
          background: 'linear-gradient(to right, var(--bg), transparent)',
        }} />
      )}
      {edges.right && (
        <div aria-hidden data-testid="settings-tabs-edge-right" style={{
          position: 'absolute', right: 0, top: 0, bottom: 1, width: 28, pointerEvents: 'none',
          background: 'linear-gradient(to left, var(--bg), transparent)',
        }} />
      )}
    </div>
  )
}
