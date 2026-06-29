/**
 * EntityDrawer — the generic right-hand detail panel used by every entity
 * (candidates, customers, vacancies, tasks…). It owns only the shell: panel
 * sizing, the header region, the tab bar and the scroll/footer areas.
 *
 * Everything else is config:
 *   header: ReactNode | ({ activeTab, setActiveTab }) => ReactNode
 *   tabs:   Array<{ id, label, badge?, autoExpand?, render: () => ReactNode }>
 *   footer: ReactNode
 *
 * `autoExpand` on a tab widens the drawer while that tab is active (e.g. planning)
 * and restores the previous width when you leave it.
 */
import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import DrawerTabs from './DrawerTabs'
import ErrorBoundary from '../ui/ErrorBoundary'

export interface EntityTab { id: string; label: ReactNode; badge?: string | number; autoExpand?: boolean; render: () => ReactNode }
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
}

export default function EntityDrawer({
  entity, header, tabs = [], footer,
  expanded, onToggleExpand,
  widthCollapsed = 580, widthExpanded = 880,
}: EntityDrawerProps) {
  const [activeTab, setActiveTab] = useState<string | undefined>(tabs[0]?.id)

  // Reset to the first tab whenever a different entity is shown (adjust during render).
  const [prevId, setPrevId] = useState<string | number | undefined>(entity?.id)
  if (entity?.id !== prevId) { setPrevId(entity?.id); setActiveTab(tabs[0]?.id) }

  const active = tabs.find(t => t.id === activeTab) ?? tabs[0]

  // Auto-expand for flagged tabs; restore when leaving.
  const autoExpandedRef = useRef(false)
  useEffect(() => {
    if (active?.autoExpand && !expanded) { autoExpandedRef.current = true; onToggleExpand?.() }
    else if (autoExpandedRef.current && expanded && !active?.autoExpand) { autoExpandedRef.current = false; onToggleExpand?.() }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entity) return null

  return (
    <div style={{ width: expanded ? widthExpanded : widthCollapsed, flexShrink: 0, height: '100%',
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
        <div style={{ marginBottom: 20 }}><ErrorBoundary key={activeTab} compact>{active?.render()}</ErrorBoundary></div>
      </div>

      {/* Footer */}
      {footer && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>{footer}</div>
      )}
    </div>
  )
}
