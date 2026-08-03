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
