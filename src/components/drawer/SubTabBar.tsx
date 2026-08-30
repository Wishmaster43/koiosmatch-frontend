/**
 * SubTabBar — the underline sub-tab strip used INSIDE a drawer tab (Planning,
 * Communication, …) and, as a plain domain switcher, in settings cards (e.g.
 * the Koios tool-matrix). One shared look (§4): active = primary underline +
 * 600 weight. Purely presentational; the host owns the active-tab state. Full
 * tablist keyboard model (arrow/Home/End + roving tabindex) comes from the
 * shared useRovingTabs hook — identical to DrawerTabs so both strips behave
 * the same for a keyboard/screen-reader user (§6).
 *
 * KOIOS-TOOL-MATRIX-FE-3 verdict finding 1 (30-08): a 12-tab domain strip
 * clipped 6 tabs at 1440 with zero cue — no scrollbar (`.no-scrollbar`), no
 * scroll-into-view, no fade. SettingsTabs had already grown that treatment
 * for its own strip that same day; this lifts it into the shared atom
 * (useTabStripOverflow) so every SubTabBar consumer inherits it, not just
 * settings' top-level category strip.
 */
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useRovingTabs } from '@/hooks/useRovingTabs'
import { useTabStripOverflow } from './useTabStripOverflow'

export interface SubTab { id: string; label: ReactNode }

export default function SubTabBar({ tabs, active, onChange }: { tabs: SubTab[]; active: string; onChange: (id: string) => void }) {
  // Shared roving-tabindex + arrow/Home/End keyboard model (see the hook doc).
  const { getRef, onKeyDown, tabIndexFor } = useRovingTabs({ ids: tabs.map(t => t.id), active, onChange })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  // Keeps the active tab scrolled into view (mount/change/resize) + tracks
  // which edge(s) still hide content, so a wide tab set never clips silently.
  const { edges } = useTabStripOverflow(containerRef, activeRef, active, tabs.length)

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} role="tablist" className="no-scrollbar" onKeyDown={onKeyDown}
        style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 4, overflowX: 'auto' }}>
        {tabs.map(sub => {
          const isActive = active === sub.id
          return (
            <button key={sub.id}
              ref={(el) => { getRef(sub.id)(el); if (isActive) activeRef.current = el }}
              role="tab" aria-selected={isActive}
              tabIndex={tabIndexFor(sub.id)} onClick={() => onChange(sub.id)}
              style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0, background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                // Active tab text uses the text-contrast token, not the raw brand color (readability on tinted primaries).
                color: isActive ? 'var(--color-primary-text)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
              {sub.label}
            </button>
          )
        })}
      </div>
      {/* Edge fades (tokens only, §4) — a visual "there's more" cue, never blocking clicks. */}
      {edges.left && (
        <div aria-hidden data-testid="subtabbar-edge-left" style={{
          position: 'absolute', left: 0, top: 0, bottom: 5, width: 24, pointerEvents: 'none',
          background: 'linear-gradient(to right, var(--surface), transparent)',
        }} />
      )}
      {edges.right && (
        <div aria-hidden data-testid="subtabbar-edge-right" style={{
          position: 'absolute', right: 0, top: 0, bottom: 5, width: 24, pointerEvents: 'none',
          background: 'linear-gradient(to left, var(--surface), transparent)',
        }} />
      )}
    </div>
  )
}
