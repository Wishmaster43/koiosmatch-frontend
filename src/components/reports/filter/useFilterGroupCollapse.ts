/**
 * useFilterGroupCollapse — per-group open/closed state for the right filter panel
 * (KANDIDAAT-100 punt 31). Busy pages (candidates: ~14 groups) default the first
 * `defaultOpenCount` REGISTERED groups open (the frequently-used ones — status/
 * fase/funnel/… — sit first in every page's group array) and the rest closed. A
 * group can opt out of the index default via its own `collapsed` flag (optional,
 * backwards-compatible — pages don't need to set it). Whatever the user then
 * toggles wins over both defaults and persists per page (localStorage, keyed by
 * page id + group key — plain field names only, never candidate/customer data).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'km.filterPanel.collapsed.'

// One collapsible group's identity + optional default-collapse override.
export interface CollapsibleGroupMeta {
  key: string
  collapsed?: boolean
}

export interface FilterGroupCollapse {
  isCollapsed: (key: string) => boolean
  toggle: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  // True once every collapsible group is open — drives the header's toggle icon/label.
  allExpanded: boolean
}

// Read the persisted per-key collapse map for a page. Storage errors (private
// browsing, quota) degrade to "nothing persisted" rather than throwing.
function readStored(pageId: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + pageId)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

// Persist the collapse map; same defensive swallow — this is a UX nicety, not data.
function writeStored(pageId: string, map: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + pageId, JSON.stringify(map))
  } catch { /* ignore — collapse state is best-effort */ }
}

// groups = the collapsible groups IN THE ORDER the page registered them (drives
// the "first N open" default). defaultOpenCount is deliberately not page-tunable
// today — every entity's most-used filters already sit first in its group array.
export function useFilterGroupCollapse(
  pageId: string,
  groups: CollapsibleGroupMeta[],
  defaultOpenCount = 4,
): FilterGroupCollapse {
  const [stored, setStored] = useState<Record<string, boolean>>(() => readStored(pageId))
  const groupKeys = useMemo(() => groups.map(g => g.key), [groups])

  // Switching page (pageId changes) reloads that page's own persisted map.
  useEffect(() => { setStored(readStored(pageId)) }, [pageId])

  // Default for a key with no stored user choice yet: its own `collapsed` flag
  // if set, else "closed unless among the first defaultOpenCount groups".
  const defaultFor = useCallback((key: string) => {
    const meta = groups.find(g => g.key === key)
    if (typeof meta?.collapsed === 'boolean') return meta.collapsed
    const idx = groupKeys.indexOf(key)
    return idx === -1 || idx >= defaultOpenCount
  }, [groups, groupKeys, defaultOpenCount])

  const isCollapsed = useCallback((key: string) => stored[key] ?? defaultFor(key), [stored, defaultFor])

  const persist = useCallback((next: Record<string, boolean>) => {
    setStored(next)
    writeStored(pageId, next)
  }, [pageId])

  const toggle = useCallback((key: string) => {
    persist({ ...stored, [key]: !isCollapsed(key) })
  }, [stored, isCollapsed, persist])

  const expandAll = useCallback(() => {
    const next = { ...stored }
    groupKeys.forEach(k => { next[k] = false })
    persist(next)
  }, [groupKeys, stored, persist])

  const collapseAll = useCallback(() => {
    const next = { ...stored }
    groupKeys.forEach(k => { next[k] = true })
    persist(next)
  }, [groupKeys, stored, persist])

  const allExpanded = useMemo(
    () => groupKeys.length > 0 && groupKeys.every(k => !isCollapsed(k)),
    [groupKeys, isCollapsed],
  )

  return { isCollapsed, toggle, expandAll, collapseAll, allExpanded }
}
