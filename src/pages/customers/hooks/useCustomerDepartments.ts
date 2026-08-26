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
import type { DeleteResult } from './subEntityDelete'

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

/**
 * Broadcast channel for "departments changed behind your back". A CSV import creates any
 * number of rows in one call, so there is no single record to splice in optimistically —
 * the list simply has to reload. Mirrors CONTACTS_CHANGED_EVENT rather than threading a
 * reload callback through DepartmentsPanel and the modal: those layers do not otherwise
 * care that the list is refetchable, and prop-drilling it would be the third copy of a
 * channel this codebase already has a convention for (§11).
 */
export const DEPARTMENTS_CHANGED_EVENT = 'km:departments-changed'

// Owns the customer-wide department list plus its optimistic add/update/remove,
// shared by the top-level tab and the per-location nested section (see file doc).
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

  // Refetch when something outside this hook created departments in bulk (import).
  useEffect(() => {
    const onChanged = () => load()
    window.addEventListener(DEPARTMENTS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(DEPARTMENTS_CHANGED_EVENT, onChanged)
  }, [load])

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

  // Delete — optimistic remove; a 409 (still referenced — the row's own `in_use`
  // flag was stale) resolves with the server's per-relation counts (SUBENTITEIT-
  // DELETE-1) instead of a blanket toast, so the caller can render the shared
  // counts dialog. Any OTHER failure still gets the old generic toast.
  const remove = useCallback((id: Id): Promise<DeleteResult> | undefined => {
    if (!customerId) return
    const snapshot = departments
    setDepartments(ds => ds.filter(x => x.id !== id))
    if (isTemp(id)) return Promise.resolve({ ok: true })
    return api.delete(`/customers/${customerId}/departments/${id}`)
      .then(() => ({ ok: true }))
      .catch(e => {
        setDepartments(snapshot)
        if (e?.response?.status === 409) {
          return { ok: false, blocked: { message: e.response.data?.message, counts: e.response.data?.counts ?? {} } }
        }
        notifyError(t('departments.deleteFailed'))
        return { ok: false }
      })
  }, [customerId, departments, t])

  return { departments, loading, error, reload: load, add, update, remove }
}

/**
 * archiveDepartment / restoreDepartment — ARCHIVE-SUBENTITY-1's reversible
 * soft-delete pair. Standalone functions (not hook-returned callbacks) so they can
 * fire from deep inside DepartmentDetail without prop-drilling a reload callback
 * through every intermediate component — mirrors archiveLocation/restoreLocation
 * in useCustomerLocations.ts, reusing the SAME DEPARTMENTS_CHANGED_EVENT the
 * import-refetch path already dispatches.
 */
export async function archiveDepartment(customerId: Id, id: Id): Promise<void> {
  await api.post(`/customers/${customerId}/departments/${id}/archive`)
  window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT))
}
// Bring a soft-deleted department back and broadcast the change event so every
// open department list (top-level tab + location section) refetches.
export async function restoreDepartment(customerId: Id, id: Id): Promise<Department> {
  const res = await api.post(`/customers/${customerId}/departments/${id}/restore`)
  window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT))
  return mapDepartment(unwrap<ApiDepartment>(res))
}

/**
 * useArchivedCustomerDepartments — the ARCHIVED-ONLY sub-list behind the panel's
 * "Gearchiveerd" quick-view (mirrors useArchivedCustomerLocations — see its own
 * doc for why this is a SEPARATE fetch rather than merged into the live list).
 * `active` gates the fetch entirely; refetches on DEPARTMENTS_CHANGED_EVENT.
 */
export function useArchivedCustomerDepartments(customerId: Id | undefined, active: boolean) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch only the soft-deleted departments; a no-op with an empty result when
  // the archived view isn't active, so this hook stays inert until toggled on.
  const load = useCallback((signal?: AbortSignal) => {
    if (!active || !customerId) { setDepartments([]); return }
    setLoading(true)
    // TRASH-OVERAL-1b (14-08): include_archived=1 now returns ONLY soft-deleted rows
    // (semantics uniform across the customer sublists); the `.filter(archived)` below
    // is a harmless belt-and-braces guard, not a workaround for a mixed response.
    api.get(`/customers/${customerId}/departments`, { params: { include_archived: 1 }, signal })
      .then(res => { if (!signal?.aborted) setDepartments(unwrapList<ApiDepartment>(res).rows.map(mapDepartment).filter(d => d.archived)) })
      .catch(() => { /* the toggle simply shows nothing rather than crashing (§3) */ })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [customerId, active])
  // Load once (and on customerId/active change), aborting any in-flight request on cleanup.
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])

  // Refetch whenever another part of the app (archive/restore, bulk import) changes departments.
  useEffect(() => {
    const ctrl = new AbortController()
    const onChanged = () => load(ctrl.signal)
    window.addEventListener(DEPARTMENTS_CHANGED_EVENT, onChanged)
    return () => { window.removeEventListener(DEPARTMENTS_CHANGED_EVENT, onChanged); ctrl.abort() }
  }, [load])

  return { departments, loading }
}
