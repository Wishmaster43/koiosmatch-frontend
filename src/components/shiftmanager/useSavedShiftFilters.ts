/**
 * useSavedShiftFilters — persist named ShiftManager filter sets. Interim storage
 * is the browser (localStorage) so "Filter opslaan/laden" works today; the storage
 * layer is deliberately isolated here so it can swap to the backend endpoint
 * (/sm_reports/saved-filters, worklist SM-FILT-SAVE) without touching the UI.
 */
import { useCallback, useEffect, useState } from 'react'

// The filter state a saved set carries (opaque to the storage layer).
export interface ShiftFilterState {
  selectedYears: number[]
  selectedMonths: string[]
  period: string
  visible: string[]
  selectedJobTypes: string[]
  selectedCustomers: string[]
  selectedLocations: string[]
}

export interface SavedShiftFilter { id: string; name: string; state: ShiftFilterState; isDefault?: boolean }

// Read the persisted list for a storage key (tolerant of corrupt/absent data).
function read(key: string): SavedShiftFilter[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

// AUDIT-3 (15-07): namespace the key by the active tenant — without it a
// super admin carried saved filter sets ACROSS tenants (cross-tenant leak of
// customer/location selections). The tenant id is UI state, not a secret.
function tenantScopedKey(key: string): string {
  const tenant = localStorage.getItem('active_tenant') ?? 'default'
  return `${key}:t=${tenant}`
}

export function useSavedShiftFilters(rawKey: string) {
  const storageKey = tenantScopedKey(rawKey)
  const [saved, setSaved] = useState<SavedShiftFilter[]>(() => read(storageKey))

  // Re-read when the key changes (different dashboard context).
  useEffect(() => { setSaved(read(storageKey)) }, [storageKey])

  // Persist the list + keep state in sync.
  const persist = useCallback((next: SavedShiftFilter[]) => {
    setSaved(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* quota / private mode — stays in memory */ }
  }, [storageKey])

  // Add (or overwrite same-name) a set.
  const save = useCallback((name: string, state: ShiftFilterState) => {
    const clean = name.trim()
    if (!clean) return
    const id = (crypto.randomUUID?.() ?? String(Date.now()))
    persist([...read(storageKey).filter(s => s.name !== clean), { id, name: clean, state }])
  }, [persist, storageKey])

  const remove = useCallback((id: string) => persist(read(storageKey).filter(s => s.id !== id)), [persist, storageKey])

  // Mark one set as the default (toggle off if it already is); only one at a time.
  const setDefault = useCallback((id: string) => {
    const list = read(storageKey)
    const wasDefault = list.find(s => s.id === id)?.isDefault
    persist(list.map(s => ({ ...s, isDefault: s.id === id ? !wasDefault : false })))
  }, [persist, storageKey])

  // The default set's filter state (applied on load), or null.
  const defaultState = saved.find(s => s.isDefault)?.state ?? null

  return { saved, save, remove, setDefault, defaultState }
}
