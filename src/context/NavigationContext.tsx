import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Id } from '@/types/common'

/**
 * NavigationContext — one place to jump between entity features. Wraps the app
 * shell's `goTo(page, intent)` so any component (drawer tabs, tables, chips) can
 * open a linked record without prop-drilling. `openEntity` navigates to the
 * target page with an `{ open: id }` intent; the page honours it via
 * `useOpenFromIntent` (below). Keeps the four features one navigable graph.
 */
type OpenEntity = (page: string, id?: Id | null) => void

const NavigationContext = createContext<{ openEntity: OpenEntity }>({ openEntity: () => {} })

export function NavigationProvider({ goTo, children }: { goTo: (page: string, intent?: unknown) => void; children: ReactNode }) {
  // Translate an entity jump into the shell's page-switch + open intent.
  const openEntity: OpenEntity = (page, id) => goTo(page, id != null ? { open: id } : null)
  return <NavigationContext.Provider value={{ openEntity }}>{children}</NavigationContext.Provider>
}

export function useNavigation() { return useContext(NavigationContext) }

/**
 * useOpenFromIntent — a page calls this with the `intent` it receives and its
 * own "open this record" function; when the intent carries `{ open: id }`, the
 * record is opened once (guarded so it doesn't re-fire on every render).
 */
export function useOpenFromIntent(intent: unknown, openById: (id: Id) => void) {
  // Guard on the intent object identity: each openEntity() call is a fresh object,
  // so re-clicking the same link (after closing) re-fires; renders don't.
  const done = useRef<unknown>(null)
  useEffect(() => {
    if (!intent || done.current === intent) return
    done.current = intent
    const id = (intent as { open?: Id }).open
    if (id != null) openById(id)
  }, [intent, openById])
}
