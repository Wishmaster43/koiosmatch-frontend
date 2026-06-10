/**
 * RightPanelContext
 * Ondersteunt meerdere componenten die elk hun eigen filterGroups registreren.
 * Alle geregistreerde groepen worden samengevoegd en getoond in het rechter panel.
 * Elk component registreert onder een unieke key zodat ze elkaar niet overschrijven.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const RightPanelContext = createContext({
  filterGroups:      [],
  registerFilters:   () => {},
  unregisterFilters: () => {},
})

export function RightPanelProvider({ children }) {
  // registry = { [key]: filterGroups[] } — één entry per registrerend component
  const [registry, setRegistry] = useState({})

  // Registreer filterGroups onder een unieke key (bijv. 'shifts-charts', 'candidates-bar')
  const registerFilters = useCallback((key, groups) => {
    setRegistry(prev => ({ ...prev, [key]: groups }))
  }, [])

  // Verwijder registratie bij unmount van het component
  const unregisterFilters = useCallback((key) => {
    setRegistry(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // Flatten alle geregistreerde groepen tot één lijst voor de sidebar
  const filterGroups = useMemo(() =>
    Object.values(registry).flat(),
    [registry]
  )

  return (
    <RightPanelContext.Provider value={{ filterGroups, registerFilters, unregisterFilters }}>
      {children}
    </RightPanelContext.Provider>
  )
}

export function useRightPanel() {
  return useContext(RightPanelContext)
}