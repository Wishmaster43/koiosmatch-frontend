/**
 * useCustomerLocations — a customer's locations: GET/POST /customers/{id}/locations +
 * PATCH/DELETE …/locations/{locId}. Full C-6 address + registration + billing fields,
 * plus the SUB-STATUS-1 lifecycle status and the `is_headquarter` toggle. Optimistic
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
  isHeadquarter: boolean
  costCenter: string
  billingEmail: string
  statusId: Id | null
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
  ...(p.isHeadquarter !== undefined ? { is_headquarter: p.isHeadquarter } : {}),
  ...(p.costCenter !== undefined ? { cost_center: p.costCenter } : {}),
  ...(p.billingEmail !== undefined ? { billing_email: p.billingEmail } : {}),
  ...(p.statusId !== undefined ? { status_id: p.statusId || null } : {}),
})

export function useCustomerLocations(customerId: Id | undefined) {
  const { t } = useTranslation('customers')
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load the list whenever the customer changes.
  const load = useCallback(() => {
    if (!customerId) { setLocations([]); setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${customerId}/locations`)
      .then(res => setLocations(unwrapList<ApiLocation>(res).rows.map(mapLocation)))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [customerId])
  useEffect(() => { load() }, [load])

  // Create — optimistic row with a temp id, swapped for the server row on success.
  const add = useCallback((payload: LocationPayload) => {
    if (!customerId) return
    const tmpId = `tmp-${Date.now()}`
    setLocations(ls => [mapLocation({ id: tmpId } as ApiLocation), ...ls])
    return api.post(`/customers/${customerId}/locations`, toApi(payload))
      .then(res => { const saved = mapLocation(unwrap<ApiLocation>(res)); setLocations(ls => ls.map(x => x.id === tmpId ? saved : x)); return saved })
      .catch(() => { setLocations(ls => ls.filter(x => x.id !== tmpId)); notifyError(t('locations.saveFailed')); return null })
  }, [customerId, t])

  // Update — optimistic patch (partial), reverts on failure.
  const update = useCallback((id: Id, payload: Partial<LocationPayload>) => {
    if (!customerId) return
    const snapshot = locations
    setLocations(ls => ls.map(x => x.id === id ? { ...x, ...(payload as Partial<Location>) } : x))
    return api.patch(`/customers/${customerId}/locations/${id}`, toApi(payload))
      .then(res => { const saved = mapLocation(unwrap<ApiLocation>(res)); setLocations(ls => ls.map(x => x.id === id ? saved : x)); return saved })
      .catch(() => { setLocations(snapshot); notifyError(t('locations.saveFailed')); return null })
  }, [customerId, locations, t])

  // Delete — optimistic remove; a 409 (still referenced) gets its own message.
  const remove = useCallback((id: Id) => {
    if (!customerId) return
    const snapshot = locations
    setLocations(ls => ls.filter(x => x.id !== id))
    if (isTemp(id)) return
    return api.delete(`/customers/${customerId}/locations/${id}`)
      .then(() => true)
      .catch(e => {
        setLocations(snapshot)
        notifyError(e?.response?.status === 409 ? t('locations.deleteInUse') : t('locations.deleteFailed'))
        return false
      })
  }, [customerId, locations, t])

  return { locations, loading, error, reload: load, add, update, remove }
}
