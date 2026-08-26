/**
 * EntityDrawer — the generic right-hand detail panel used by every entity
 * (candidates, customers, vacancies, tasks…). It owns only the shell: panel
 * sizing, the header region, the tab bar and the scroll/footer areas.
 *
 * Everything else is config:
 *   header: ReactNode | ({ activeTab, setActiveTab }) => ReactNode
 *   tabs:   Array<{ id, label, badge?, autoExpand?, render: (setActiveTab?: (id: string) => void) => ReactNode }>
 *   footer: ReactNode
 *
 * `autoExpand` on a tab widens the drawer while that tab is active (e.g. planning)
 * and restores the previous width when you leave it.
 */
import { useState, useRef, useEffect } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'
import DrawerTabs from './DrawerTabs'
import { DrawerPopoutRegistryProvider } from './DrawerPopoutRegistry'
import ErrorBoundary from '../ui/ErrorBoundary'

export interface EntityTab { id: string; label: ReactNode; badge?: string | number; autoExpand?: boolean; render: (setActiveTab?: (id: string) => void) => ReactNode }
type HeaderArg = { activeTab?: string; setActiveTab: (id: string) => void }

interface EntityDrawerProps {
  entity?: { id?: string | number } | null
  header?: ReactNode | ((arg: HeaderArg) => ReactNode)
  tabs?: EntityTab[]
  footer?: ReactNode
  expanded?: boolean
  onToggleExpand?: () => void
  widthCollapsed?: number
  widthExpanded?: number
  // Open on this tab instead of the first one (deep-links from table cells).
  initialTab?: string
}

// Generic panel shell: sizing, header, tab bar and scroll/footer — see the module doc above for what's config vs. owned here.
export default function EntityDrawer({
  entity, header, tabs = [], footer,
  expanded, onToggleExpand,
  widthCollapsed = 580, widthExpanded = 880,
  initialTab,
}: EntityDrawerProps) {
  const [activeTab, setActiveTab] = useState<string | undefined>(initialTab ?? tabs[0]?.id)

  // Reset whenever a different entity is shown (adjust during render); a deep-link
  // (initialTab — e.g. table contact-cell → Communicatie) wins over the first tab.
  const [prevId, setPrevId] = useState<string | number | undefined>(entity?.id)
  if (entity?.id !== prevId) { setPrevId(entity?.id); setActiveTab(initialTab ?? tabs[0]?.id) }
  // Same entity, new deep-link click → switch tabs; manual browsing stays untouched.
  const [prevInitial, setPrevInitial] = useState(initialTab)
  if (initialTab !== prevInitial) { setPrevInitial(initialTab); if (initialTab) setActiveTab(initialTab) }

  const active = tabs.find(t => t.id === activeTab) ?? tabs[0]

  // Auto-expand for flagged tabs; restore when leaving.
  const autoExpandedRef = useRef(false)
  // An effect (not derived state) because it must fire the SIDE EFFECT (onToggleExpand) exactly once per tab switch, not recompute a value every render.
  useEffect(() => {
    if (active?.autoExpand && !expanded) { autoExpandedRef.current = true; onToggleExpand?.() }
    else if (autoExpandedRef.current && expanded && !active?.autoExpand) { autoExpandedRef.current = false; onToggleExpand?.() }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // SWEEP-ESC: Escape closes the drawer by clicking the header's own close button
  // (marked `data-drawer-close` on EntityHeader) — every entity drawer already wires
  // a real onClose onto that button (§3A), so this needs no new onClose prop and no
  // caller-side change at all. Listening in the BUBBLE phase on this root node is
  // what makes it respect an already-open nested popup: a FloatingPanel modal either
  // (a) is mounted as a REACT SIBLING of EntityDrawer by every caller — MatchDrawer/
  // ApplicationDrawer/etc. render it alongside, not inside, EntityDrawer — so its
  // keydown never reaches this subtree at all, or (b) is a genuine DOM descendant
  // (a modal opened from within a tab) and already owns a CLOSER bubble-phase
  // listener on its own node (useFocusTrap) that calls stopPropagation first. A
  // SelectMenu dropdown's own Escape handling runs even earlier, in the document
  // CAPTURE phase (see SelectMenu.tsx's ordering comment) — also stopping this
  // listener from ever firing. Verified against both useFocusTrap.ts and
  // SelectMenu.tsx before writing this, per the ordering they already established.
  const rootRef = useRef<HTMLDivElement>(null)
  // Escape closes the drawer via the header's own close button (see the SWEEP-ESC note above) rather than owning a second close path here.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    rootRef.current?.querySelector<HTMLButtonElement>('[data-drawer-close]')?.click()
  }

  if (!entity) return null

  return (
    // KLANTEN 5: popout windows opened from any tab close when THIS subtree
    // unmounts (the drawer really closed) — see DrawerPopoutRegistry's header.
    <DrawerPopoutRegistryProvider>
    <div ref={rootRef} onKeyDown={handleKeyDown}
      style={{ width: expanded ? widthExpanded : widthCollapsed, flexShrink: 0, height: '100%',
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden' }}>

      {/* Header region: composed header + tab bar */}
      <div style={{ padding: '14px 16px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {typeof header === 'function' ? header({ activeTab, setActiveTab }) : header}
        <DrawerTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Scrollable tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* Local boundary so one crashing tab never blanks the whole drawer (§3); keyed per tab so it resets on switch. */}
        <div style={{ marginBottom: 20 }}><ErrorBoundary key={activeTab} compact>{active?.render(setActiveTab)}</ErrorBoundary></div>
      </div>

      {/* Footer */}
      {footer && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>{footer}</div>
      )}
    </div>
    </DrawerPopoutRegistryProvider>
  )
}
