/**
 * DrawerPopoutRegistry — KLANTEN 5 (21-08, rebuilt after the verify round
 * REJECTED the host-unmount version): closing the DRAWER closes its popped-out
 * second-screen windows; a mere tab switch must NOT (the host tab unmounts on
 * every switch, so a host-scoped cleanup destroyed the recruiter's second
 * screen — and its unsaved text — on nine screens). The registry therefore
 * lives at the DRAWER level: hosts register the windows they open; when the
 * provider unmounts (EntityDrawer's entity cleared = the drawer really closed)
 * every still-open registered window closes with it. A host outside any drawer
 * (MatchModal, CollapsibleRichText) finds no registry and keeps today's
 * behaviour. Switching RECORDS inside one open drawer keeps the provider
 * mounted, so an older record's popout stays open — unchanged pre-existing
 * behaviour, per-record channels prevent any cross-talk.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface DrawerPopoutRegistry {
  // Adopt one opened popout window into this drawer's lifetime.
  register: (w: Window) => void
}

const RegistryContext = createContext<DrawerPopoutRegistry | null>(null)

// Optional consumer: null outside any drawer (then nothing auto-closes).
// eslint-disable-next-line react-refresh/only-export-components -- the hook and its provider ship together by design; HMR-nicety warning only (house precedent: FreeEntryMismatchDialog)
export function useDrawerPopoutRegistry(): DrawerPopoutRegistry | null {
  return useContext(RegistryContext)
}

export function DrawerPopoutRegistryProvider({ children }: { children: ReactNode }) {
  // One stable pair for this provider's lifetime: the window set + the registry
  // object handed to consumers (useState initializer — no ref reads in render).
  const [state] = useState(() => {
    const windows = new Set<Window>()
    const registry: DrawerPopoutRegistry = { register: w => windows.add(w) }
    return { windows, registry }
  })

  // Provider unmount = the drawer really closed: close every still-open window.
  // The function-guard keeps a partial WindowProxy (test doubles) from throwing.
  useEffect(() => () => {
    for (const w of state.windows) { if (!w.closed && typeof w.close === 'function') w.close() }
    state.windows.clear()
  }, [state])

  return <RegistryContext.Provider value={state.registry}>{children}</RegistryContext.Provider>
}
