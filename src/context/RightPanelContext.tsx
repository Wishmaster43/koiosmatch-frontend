/**
 * RightPanelContext
 * Supports multiple components that each register their own filterGroups. All
 * registered groups are merged and shown in the right-hand panel. Each component
 * registers under a unique key so they don't overwrite one another.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// A filter group's exact shape varies per registrant — kept loose here.
export type FilterGroup = Record<string, unknown>

interface RightPanelValue {
  filterGroups: FilterGroup[]
  registerFilters: (key: string, groups: FilterGroup[]) => void
  unregisterFilters: (key: string) => void
}

const RightPanelContext = createContext<RightPanelValue>({
  filterGroups:      [],
  registerFilters:   () => {},
  unregisterFilters: () => {},
})

export function RightPanelProvider({ children }: { children: ReactNode }) {
  // registry = { [key]: filterGroups[] } — one entry per registering component.
  const [registry, setRegistry] = useState<Record<string, FilterGroup[]>>({})

  // Register filterGroups under a unique key (e.g. 'shifts-charts', 'candidates-bar').
  const registerFilters = useCallback((key: string, groups: FilterGroup[]) => {
    setRegistry(prev => ({ ...prev, [key]: groups }))
  }, [])

  // Remove a registration when the component unmounts.
  const unregisterFilters = useCallback((key: string) => {
    setRegistry(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // Flatten all registered groups into one list for the sidebar.
  const filterGroups = useMemo(() => Object.values(registry).flat(), [registry])

  return (
    <RightPanelContext.Provider value={{ filterGroups, registerFilters, unregisterFilters }}>
      {children}
    </RightPanelContext.Provider>
  )
}

export function useRightPanel(): RightPanelValue {
  return useContext(RightPanelContext)
}
