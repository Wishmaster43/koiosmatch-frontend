/**
 * useCustomerLocations — a customer's locations: GET/POST /customers/{id}/locations +
 * PATCH/DELETE …/locations/{locId}. Full C-6 address + registration + billing fields,
 * plus the SUB-STATUS-1 lifecycle status. Optimistic
 * add/update/remove, reconciled with the server row; reverts + toasts on failure
 * (mirrors usePriceAgreements — one shared shape for entity sub-resource CRUD).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { mapLocation } from '../data/mapCustomer'
import type { Location, ApiLocation } from '@/types/customer'
import type { Id } from '@/types/common'
import type { DeleteResult } from './subEntityDelete'

// The editable payload — every BE-accepted field (CustomerLocationController::rules).
export interface LocationPayload {
  name: string
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  city: string
  state: string
  country: string
  cocNumber: string
  vatNumber: string
  contactName: string
  phone: string
  email: string
  costCenter: string
  billingEmail: string
  statusId: Id | null
  // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): free company text about this site, same
  // shape/limit as the department's own `description` (max 5000, CustomerLocationController::rules).
  description: string
  // Tenant custom-field values (§3B "Eigen velden" — the Extra sub-tab).
  customFields: Record<string, unknown>  /** LOCATIE-VESTIGING-1 — empty array = no deviation (inherit the customer's set). */
  branchIds: Id[]
}

/**
 * Broadcast channel for "this customer's location list changed underneath you"
 * (mirrors DEPARTMENTS_CHANGED_EVENT/CONTACTS_CHANGED_EVENT). ARCHIVE-SUBENTITY-1's
 * archive/restore/merge actions fire from the drill-down, several hops away from
 * the hook instance CustomerDrawer owns — rather than prop-drilling a reload
 * callback through LocationsTab/LocationDetail, they dispatch this and the one
 * hook that OWNS the live list refetches (same `km:` CustomEvent convention).
 */
export const LOCATIONS_CHANGED_EVENT = 'km:locations-changed'

const isTemp = (id: Id | undefined) => typeof id === 'string' && id.startsWith('tmp-')

// Build the API body from the payload — empty strings go through as '' (the BE
// rules are `nullable` so an explicit clear is honoured, never silently dropped).
const toApi = (p: Partial<LocationPayload>) => ({
  ...(p.name !== undefined ? { name: p.name } : {}),
  ...(p.street !== undefined ? { street: p.street } : {}),
  ...(p.houseNumber !== undefined ? { house_number: p.houseNumber } : {}),
  ...(p.houseNumberSuffix !== undefined ? { house_number_suffix: p.houseNumberSuffix } : {}),
  ...(p.postalCode !== undefined ? { postcode: p.postalCode } : {}),
  ...(p.city !== undefined ? { city: p.city } : {}),
  ...(p.state !== undefined ? { state: p.state } : {}),
  ...(p.country !== undefined ? { country: p.country } : {}),
  ...(p.cocNumber !== undefined ? { coc_number: p.cocNumber } : {}),
  ...(p.vatNumber !== undefined ? { vat_number: p.vatNumber } : {}),
  ...(p.contactName !== undefined ? { contact_name: p.contactName } : {}),
  ...(p.phone !== undefined ? { phone: p.phone } : {}),
  ...(p.email !== undefined ? { email: p.email } : {}),
  ...(p.costCenter !== undefined ? { cost_center: p.costCenter } : {}),
  ...(p.billingEmail !== undefined ? { billing_email: p.billingEmail } : {}),
  ...(p.statusId !== undefined ? { status_id: p.statusId || null } : {}),
  ...(p.description !== undefined ? { description: p.description } : {}),
  ...(p.customFields !== undefined ? { custom_fields: p.customFields } : {}),
  // LOCATIE-VESTIGING-1: this site's OWN branch couplings. An ABSENT key leaves the
  // deviation untouched; an EMPTY ARRAY clears it, which is how a site goes back to
  // inheriting the customer's branches. So it must be sent as [], never omitted.
  ...(p.branchIds !== undefined ? { branch_ids: p.branchIds } : {}),
})

// Monotonic counter behind the optimistic row id (see `add`).
let tempLocationSeq = 0

export function useCustomerLocations(customerId: Id | undefined) {
  const { t } = useTranslation('customers')
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load the list whenever the customer changes.
  // Audit r4 (§9): abortable load — see useCustomerContacts (same race/unmount guard).
  const load = useCallback((signal?: AbortSignal) => {
    if (!customerId) { setLocations([]); setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${customerId}/locations`, { signal })
      .then(res => { if (!signal?.aborted) setLocations(unwrapList<ApiLocation>(res).rows.map(mapLocation)) })
      .catch(err => { if (err?.code !== 'ERR_CANCELED' && !signal?.aborted) setError(true) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [customerId])
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])

  // ARCHIVE-SUBENTITY-1: refetch when an out-of-tree writer (archive/restore/merge,
  // fired from deep inside LocationDetail) changed this list. Registered in the
  // effect SETUP so StrictMode's setup→cleanup→setup re-arms it (§9).
  useEffect(() => {
    const ctrl = new AbortController()
    const onChanged = () => load(ctrl.signal)
    window.addEventListener(LOCATIONS_CHANGED_EVENT, onChanged)
    return () => { window.removeEventListener(LOCATIONS_CHANGED_EVENT, onChanged); ctrl.abort() }
  }, [load])

  // Create — optimistic row with a temp id, swapped for the server row on success.
  // Only the Add-modal's create path calls this (inline edits go through `update`
  // below), so it rethrows on failure instead of swallowing to null — the modal
  // awaits it and maps 422 field errors (C-18) rather than a generic toast that
  // fired while the modal closed regardless.
  const add = useCallback((payload: LocationPayload) => {
    if (!customerId) return
    // Unique per call, not per millisecond: `Date.now()` alone collides when several
    // rows are added in the same tick, and everything downstream keys on this id
    // (the same collision that duplicated document rows and made bulk-delete 404).
    const tmpId = `tmp-${Date.now()}-${++tempLocationSeq}`
    setLocations(ls => [mapLocation({ id: tmpId } as ApiLocation), ...ls])
    return api.post(`/customers/${customerId}/locations`, toApi(payload))
      .then(res => { const saved = mapLocation(unwrap<ApiLocation>(res)); setLocations(ls => ls.map(x => x.id === tmpId ? saved : x)); return saved })
      .catch(err => { setLocations(ls => ls.filter(x => x.id !== tmpId)); throw err })
  }, [customerId])

  // Update — optimistic patch (partial), reverts on failure.
  const update = useCallback((id: Id, payload: Partial<LocationPayload>) => {
    if (!customerId) return
    const snapshot = locations
    // A status change carries only `statusId`; the human label/colour live on the row and
    // this hook cannot resolve the new ones. Blanking them beats keeping the OLD pair —
    // the badge briefly shows nothing instead of confidently showing the status you just
    // replaced. The PATCH response one round-trip later fills in the real values.
    const optimistic = { ...(payload as Partial<Location>) }
    if ('statusId' in payload) Object.assign(optimistic, { statusLabel: '', statusColor: '' })
    setLocations(ls => ls.map(x => x.id === id ? { ...x, ...optimistic } : x))
    return api.patch(`/customers/${customerId}/locations/${id}`, toApi(payload))
      .then(res => { const saved = mapLocation(unwrap<ApiLocation>(res)); setLocations(ls => ls.map(x => x.id === id ? saved : x)); return saved })
      .catch(() => { setLocations(snapshot); notifyError(t('locations.saveFailed')); return null })
  }, [customerId, locations, t])

  // Delete — optimistic remove; a 409 (still referenced — the row's own `in_use`
  // flag was stale) resolves with the server's per-relation counts (SUBENTITEIT-
  // DELETE-1) instead of a blanket toast, so the caller can render the shared
  // counts dialog. Any OTHER failure still gets the old generic toast.
  const remove = useCallback((id: Id): Promise<DeleteResult> | undefined => {
    if (!customerId) return
    const snapshot = locations
    setLocations(ls => ls.filter(x => x.id !== id))
    if (isTemp(id)) return Promise.resolve({ ok: true })
    return api.delete(`/customers/${customerId}/locations/${id}`)
      .then(() => ({ ok: true }))
      .catch(e => {
        setLocations(snapshot)
        if (e?.response?.status === 409) {
          return { ok: false, blocked: { message: e.response.data?.message, counts: e.response.data?.counts ?? {} } }
        }
        notifyError(t('locations.deleteFailed'))
        return { ok: false }
      })
  }, [customerId, locations, t])

  return { locations, loading, error, reload: load, add, update, remove }
}

/**
 * archiveLocation / restoreLocation — ARCHIVE-SUBENTITY-1's reversible soft-delete
 * pair (POST …/archive, POST …/restore). Standalone functions rather than
 * hook-returned callbacks: they are fired from deep inside LocationDetail, several
 * hops away from the hook instance CustomerDrawer owns (mirrors
 * setLocationPrimaryContact in useCustomerContacts.ts, the exact same class of
 * problem). Dispatching LOCATIONS_CHANGED_EVENT lets that owning instance refetch
 * without prop-drilling a reload callback through every intermediate component.
 */
export async function archiveLocation(customerId: Id, id: Id): Promise<void> {
  await api.post(`/customers/${customerId}/locations/${id}/archive`)
  window.dispatchEvent(new CustomEvent(LOCATIONS_CHANGED_EVENT))
}
export async function restoreLocation(customerId: Id, id: Id): Promise<Location> {
  const res = await api.post(`/customers/${customerId}/locations/${id}/restore`)
  window.dispatchEvent(new CustomEvent(LOCATIONS_CHANGED_EVENT))
  return mapLocation(unwrap<ApiLocation>(res))
}

/**
 * uploadLocationLogo — K4BLOGO: POST …/locations/{id}/logo (multipart), replacing
 * whatever logo existed. The BE returns only `{ logo_url }` (a fresh signed URL,
 * never the whole location), so the caller merges it into its own row rather than
 * expecting a full record back. Standalone (mirrors archiveLocation/restoreLocation
 * above) — fired from the drill-down's own title row, several hops from the hook
 * instance CustomerDrawer owns.
 */
export async function uploadLocationLogo(customerId: Id, id: Id, file: File): Promise<string> {
  const body = new FormData()
  body.append('logo', file)
  const res = await api.post(`/customers/${customerId}/locations/${id}/logo`, body)
  return unwrap<{ logo_url?: string }>(res).logo_url ?? ''
}

/**
 * useArchivedCustomerLocations — the ARCHIVED-ONLY sub-list behind the panel's
 * "Gearchiveerd" quick-view. A separate, independent fetch (never merged into the
 * live `useCustomerLocations` state above) so every OTHER consumer of the live
 * list — add-modal location pickers, the branch/contact couplers — keeps seeing
 * exactly today's archived-excluded set; only this toggle opts in. `active` gates
 * the fetch entirely (false = no request, zero cost while the toggle is off) and
 * refetches on LOCATIONS_CHANGED_EVENT so an archive/restore/merge fired from
 * anywhere keeps this list in sync with the live one.
 */
export function useArchivedCustomerLocations(customerId: Id | undefined, active: boolean) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback((signal?: AbortSignal) => {
    if (!active || !customerId) { setLocations([]); return }
    setLoading(true)
    // TRASH-OVERAL-1b (14-08): include_archived=1 now returns ONLY soft-deleted rows
    // (semantics uniform across the customer sublists); the `.filter(archived)` below
    // is a harmless belt-and-braces guard, not a workaround for a mixed response.
    api.get(`/customers/${customerId}/locations`, { params: { include_archived: 1 }, signal })
      .then(res => { if (!signal?.aborted) setLocations(unwrapList<ApiLocation>(res).rows.map(mapLocation).filter(l => l.archived)) })
      .catch(() => { /* the toggle simply shows nothing rather than crashing (§3) */ })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [customerId, active])
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])

  useEffect(() => {
    const ctrl = new AbortController()
    const onChanged = () => load(ctrl.signal)
    window.addEventListener(LOCATIONS_CHANGED_EVENT, onChanged)
    return () => { window.removeEventListener(LOCATIONS_CHANGED_EVENT, onChanged); ctrl.abort() }
  }, [load])

  return { locations, loading }
}
