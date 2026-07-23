/**
 * useCustomerDepartments — a customer's departments: GET/POST /customers/{id}/departments
 * + PATCH/DELETE …/departments/{depId}. A department always lives under a location
 * (location_id required on create; movable on update per CustomerDepartmentController).
 * Fetches the FULL customer-wide list once — shared by the top-level Afdelingen tab
 * AND the location detail's nested "Afdelingen op deze locatie" section (filtered
 * client-side by locationId), so both stay one source of truth. Optimistic
 * add/update/remove, reverts + toasts on failure (mirrors usePriceAgreements).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { mapDepartment } from '../data/mapCustomer'
import type { Department, ApiDepartment } from '@/types/customer'
import type { Id } from '@/types/common'

// The editable payload — the fields CustomerDepartmentController::store/update accept.
export interface DepartmentPayload {
  name: string
  locationId: Id | string
  description: string
  // Kostenplaats (Danny 2026-07-22) — the middle cascade level (afdeling > locatie
  // > klant); no billingEmail here, facturatie stays the customer's own.
  costCenter: string
  statusId: Id | null
  // Tenant custom-field values (§3B "Eigen velden" — the Extra sub-tab).
  customFields: Record<string, unknown>
}

const isTemp = (id: Id | undefined) => typeof id === 'string' && id.startsWith('tmp-')

const toApi = (p: Partial<DepartmentPayload>) => ({
  ...(p.name !== undefined ? { name: p.name } : {}),
  ...(p.locationId !== undefined ? { location_id: p.locationId } : {}),
  ...(p.description !== undefined ? { description: p.description } : {}),
  ...(p.costCenter !== undefined ? { cost_center: p.costCenter } : {}),
  ...(p.statusId !== undefined ? { status_id: p.statusId || null } : {}),
  ...(p.customFields !== undefined ? { custom_fields: p.customFields } : {}),
})

export function useCustomerDepartments(customerId: Id | undefined) {
  const { t } = useTranslation('customers')
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Audit r4 (§9): abortable load — see useCustomerContacts (same race/unmount guard).
  const load = useCallback((signal?: AbortSignal) => {
    if (!customerId) { setDepartments([]); setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${customerId}/departments`, { signal })
      .then(res => { if (!signal?.aborted) setDepartments(unwrapList<ApiDepartment>(res).rows.map(mapDepartment)) })
      .catch(err => { if (err?.code !== 'ERR_CANCELED' && !signal?.aborted) setError(true) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [customerId])
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])

  // Create — optimistic row with a temp id + the picked location's name pre-filled
  // by the caller (via `locationName`), swapped for the server row on success.
  // Only the Add-modal's create path calls this (inline edits go through `update`
  // below), so it rethrows on failure instead of swallowing to null — the modal
  // awaits it and maps 422 field errors (C-18) rather than a generic toast that
  // fired while the modal closed regardless.
  const add = useCallback((payload: DepartmentPayload, locationName?: string) => {
    if (!customerId) return
    const tmpId = `tmp-${Date.now()}`
    setDepartments(ds => [{ ...mapDepartment({ id: tmpId } as ApiDepartment), name: payload.name, locationId: payload.locationId, locationName: locationName ?? '' }, ...ds])
    return api.post(`/customers/${customerId}/departments`, toApi(payload))
      .then(res => { const saved = mapDepartment(unwrap<ApiDepartment>(res)); const withLoc = { ...saved, locationName: saved.locationName || locationName || '' }; setDepartments(ds => ds.map(x => x.id === tmpId ? withLoc : x)); return withLoc })
      .catch(err => { setDepartments(ds => ds.filter(x => x.id !== tmpId)); throw err })
  }, [customerId])

  // Update — optimistic patch; reverts the whole list on failure.
  const update = useCallback((id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => {
    if (!customerId) return
    const snapshot = departments
    setDepartments(ds => ds.map(x => x.id === id ? { ...x, ...(payload as Partial<Department>), ...(locationName !== undefined ? { locationName } : {}) } : x))
    return api.patch(`/customers/${customerId}/departments/${id}`, toApi(payload))
      .then(res => { const saved = mapDepartment(unwrap<ApiDepartment>(res)); const withLoc = { ...saved, locationName: saved.locationName || locationName || '' }; setDepartments(ds => ds.map(x => x.id === id ? withLoc : x)); return withLoc })
      .catch(() => { setDepartments(snapshot); notifyError(t('departments.saveFailed')); return null })
  }, [customerId, departments, t])

  // Delete — optimistic remove; a 409 (still referenced, e.g. by contacts) gets its own message.
  const remove = useCallback((id: Id) => {
    if (!customerId) return
    const snapshot = departments
    setDepartments(ds => ds.filter(x => x.id !== id))
    if (isTemp(id)) return
    return api.delete(`/customers/${customerId}/departments/${id}`)
      .then(() => true)
      .catch(e => {
        setDepartments(snapshot)
        notifyError(e?.response?.status === 409 ? t('departments.deleteInUse') : t('departments.deleteFailed'))
        return false
      })
  }, [customerId, departments, t])

  return { departments, loading, error, reload: load, add, update, remove }
}
