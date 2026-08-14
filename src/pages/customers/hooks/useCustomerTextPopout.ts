/**
 * useCustomerTextPopout — K3/K5 (batch 5): the second-screen plumbing for the
 * customer's bedrijfstekst and a department's omschrijving, mirroring
 * useCandidateLite/patchCandidate (candidates/hooks/useCandidateMutations.ts +
 * popout/hooks/useCandidateLite.ts) 1:1 — a light identity fetch per popped-out
 * record plus a standalone PATCH, so the popup window (a separate render tree
 * with no access to the drawer's own list/detail state) can load and save on
 * its own.
 *
 * Department has NO standalone GET /customers/{cid}/departments/{id} route
 * (only index + PATCH) — the ruling K5a settled this: fetch the customer's
 * department LIST and find the one row (mirrors the drawer's own
 * useCustomerDepartments), never invent a route the backend doesn't have.
 */
import { useCallback, useEffect, useState } from 'react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

export interface CustomerLite { id: string; name: string; initials: string; description: string }
export interface DepartmentLite { id: string; customerId: string; name: string; description: string }
export interface LocationLite { id: string; name: string; description: string }

// The subset of the raw customer/department/location resource these popouts actually read.
interface RawCustomerLite { id?: Id; name?: string; description?: string | null }
interface RawDepartmentLite { id?: Id; name?: string; description?: string | null }
interface RawLocationLite { id?: Id; name?: string; description?: string | null }

// Light identity fetch for the popped-out customer bedrijfstekst window.
export function useCustomerTextLite(id: string | undefined) {
  const [customer, setCustomer] = useState<CustomerLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!id) { setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${id}`)
      .then(r => {
        const raw = unwrap<RawCustomerLite>(r)
        const name = raw.name ?? '?'
        setCustomer({ id: String(raw.id ?? id), name, initials: initialsOf(name), description: raw.description ?? '' })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])
  return { customer, loading, error, reload: load }
}

// Light identity fetch for the popped-out department omschrijving window — reads
// the customer-wide department LIST and picks the one row (no single-record GET,
// see the file header).
export function useDepartmentTextLite(customerId: string | undefined, departmentId: string | undefined) {
  const [department, setDepartment] = useState<DepartmentLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!customerId || !departmentId) { setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${customerId}/departments`)
      .then(r => {
        const row = unwrapList<RawDepartmentLite>(r).rows.find(d => String(d.id) === departmentId)
        if (!row) { setError(true); return }
        setDepartment({ id: departmentId, customerId, name: row.name ?? '?', description: row.description ?? '' })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [customerId, departmentId])

  useEffect(() => { load() }, [load])
  return { department, loading, error, reload: load }
}

// K3/K4c: light identity fetch for the popped-out location omschrijving window.
// Unlike departments, a standalone `GET /locations/{id}` route exists (no
// customer prefix needed — LocationController::show), so this is a direct
// single-record fetch, mirroring useCustomerTextLite rather than the
// list-and-find department pattern above.
export function useLocationTextLite(locationId: string | undefined) {
  const [location, setLocation] = useState<LocationLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!locationId) { setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/locations/${locationId}`)
      .then(r => {
        const raw = unwrap<RawLocationLite>(r)
        setLocation({ id: String(raw.id ?? locationId), name: raw.name ?? '?', description: raw.description ?? '' })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [locationId])

  useEffect(() => { load() }, [load])
  return { location, loading, error, reload: load }
}

// Standalone PATCH /locations/{id} — same field LocationAddressTab's
// saveDescription writes through useCustomerLocations.update.
export function patchLocationText(locationId: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/locations/${locationId}`, { description: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}

// Standalone PATCH /customers/{id} — same field the drawer's own OverviewTab
// writes (`description`, FIELD_MAP in useCustomerRecord.ts), called directly here
// since the popup window has no drawer state to route an optimistic patch through.
export function patchCustomerText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/customers/${id}`, { description: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}

// Standalone PATCH /customers/{cid}/departments/{id} — same field
// DepartmentDetail's saveDescription writes through useCustomerDepartments.update.
export function patchDepartmentText(customerId: Id, departmentId: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/customers/${customerId}/departments/${departmentId}`, { description: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
