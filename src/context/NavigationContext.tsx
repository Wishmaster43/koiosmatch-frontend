/**
 * NavigationContext — one place to jump between entity features. Wraps the app
 * shell's `goTo(page, intent)` so any component (drawer tabs, tables, chips) can
 * open a linked record without prop-drilling. `openEntity` navigates to the
 * target page with an `{ open: id, tab? }` intent; the page honours it via
 * `useOpenFromIntent` (below). Keeps the four features one navigable graph.
 * The optional `tab` (K7c, customer drawer's vacancy applications ghost-link)
 * lets a cross-page deep link land on a specific drawer tab, not just the
 * record's default view — a page that ignores it simply opens on its default.
 */
import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Id } from '@/types/common'
type OpenEntity = (page: string, id?: Id | null, tab?: string) => void
type Navigate = (page: string, intent?: unknown) => void

const NavigationContext = createContext<{ openEntity: OpenEntity; navigate: Navigate }>({ openEntity: () => {}, navigate: () => {} })

export function NavigationProvider({ goTo, children }: { goTo: (page: string, intent?: unknown) => void; children: ReactNode }) {
  // Translate an entity jump into the shell's page-switch + open intent; `navigate`
  // is the generic page-switch with an arbitrary intent (KPI → filtered list jumps).
  const openEntity: OpenEntity = (page, id, tab) => goTo(page, id != null ? { open: id, tab } : null)
  return <NavigationContext.Provider value={{ openEntity, navigate: goTo }}>{children}</NavigationContext.Provider>
}

export function useNavigation() { return useContext(NavigationContext) }

/**
 * useOpenFromIntent — a page calls this with the `intent` it receives and its
 * own "open this record" function; when the intent carries `{ open: id }`, the
 * record is opened once (guarded so it doesn't re-fire on every render). The
 * optional second argument to `openById` carries the intent's `tab`, if any.
 */
export function useOpenFromIntent(intent: unknown, openById: (id: Id, tab?: string) => void) {
  // Guard on the intent object identity: each openEntity() call is a fresh object,
  // so re-clicking the same link (after closing) re-fires; renders don't.
  const done = useRef<unknown>(null)
  useEffect(() => {
    if (!intent || done.current === intent) return
    done.current = intent
    const { open: id, tab } = intent as { open?: Id; tab?: string }
    if (id != null) openById(id, tab)
  }, [intent, openById])
}
