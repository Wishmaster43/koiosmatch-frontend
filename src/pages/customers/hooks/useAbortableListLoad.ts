/**
 * useAbortableListLoad — the mount-time AbortController effect + change-event
 * refetch tail, byte-identical across the customer sub-entity list hooks (DRY
 * round 11, CUSTTABS2): useCustomerContacts/useCustomerLocations's live list,
 * and useCustomerContacts/useCustomerLocations/useCustomerDepartments's
 * archived-only list. The caller's own `load` callback keeps its own
 * guard/loading-state shape (the live-list guard resets `loading` to false on
 * no-customerId, the archived-list guard does not — a shared load MUST take
 * the caller's own callback, never bake one copy's guard into shared code,
 * see round-9's CUSTTABS verdict on the contacts-dedupe case). Excludes
 * useCustomerDepartments' own LIVE list, which refetches via a raw
 * addEventListener instead of useEntityChangeListener — a real, measured
 * difference (notDone).
 */
import { useEffect } from 'react'
import { useEntityChangeListener } from '@/hooks/useEntityChangeListener'

// Runs `load` once on mount (aborting on cleanup) and again on every
// `changedEvent` dispatch — see the module doc above for the exact shape this covers.
export function useAbortableListLoad(load: (signal?: AbortSignal) => void, changedEvent: string) {
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])
  useEntityChangeListener(changedEvent, load)
}
