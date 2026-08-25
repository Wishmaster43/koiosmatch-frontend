/**
 * SelectionContext — the active list page's table selection, shared with Koios
 * AI (KOIOS-SELECTIE-CONTEXT-1, Danny: "als ik een taak of kandidaat selecteer
 * moet ik dit terugzien in Koios AI" — when I select a task or candidate I must
 * see this reflected in Koios AI). Exactly ONE list page is ever mounted at
 * a time (DashboardLayout's renderPage swaps the whole page component, never
 * two side by side), so this is a single slot — not a per-key registry like
 * RightPanelContext, which genuinely has multiple simultaneous registrants.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Id } from '@/types/common'

// `entity` is the page's own route/nav key ('candidates', 'vacancies', …) so a
// consumer can build both the i18n label (`nav.<entity>`) and the outgoing
// context-ref `type` from it. `label` is optional — a page may override the
// default nav-label-derived text; every current publisher omits it.
export interface EntitySelection {
  entity: string
  ids: Id[]
  label?: string
}

interface SelectionContextValue {
  selection: EntitySelection | null
  setSelection: (selection: EntitySelection | null) => void
}

const SelectionContext = createContext<SelectionContextValue>({
  selection: null,
  setSelection: () => {},
})

// Mounted once in DashboardLayout, wrapping BOTH the routed page and KoiosPanel
// (which renders as its sibling, outside NavigationProvider) so both sides
// share the one slot.
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<EntitySelection | null>(null)
  const value = useMemo(() => ({ selection, setSelection }), [selection])
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- same context+hook single-file shape as every other context/* provider (RightPanelContext, NavigationContext, TaskLookupsContext, …); HMR-granularity nicety only, not correctness
export function useSelectionContext(): SelectionContextValue {
  return useContext(SelectionContext)
}

// Mechanical per-page publisher: mirrors a page's own `selectedIds` Set into
// the shared slot — one call per list page (see the 8 call sites). Clearing
// runs both when the Set empties AND on unmount (the cleanup), so an emptied
// selection or a page switch never leaves a stale chip behind in Koios.
// eslint-disable-next-line react-refresh/only-export-components -- same reason as useSelectionContext above
export function usePublishSelection(entity: string, ids: Set<Id>, label?: string): void {
  const { setSelection } = useSelectionContext()
  useEffect(() => {
    setSelection(ids.size > 0 ? { entity, ids: Array.from(ids), label } : null)
    return () => setSelection(null)
  }, [entity, ids, label, setSelection])
}
