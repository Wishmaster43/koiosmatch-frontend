/**
 * useMatchClientEdit — K-281 MATCH-CLIENT-EDIT: the reassign-flow state machine
 * for one match's client/location/department. Draft state is seeded from the
 * match's current values on entering edit; the customer -> location ->
 * department cascade reuses the SAME shared hooks the + Match modal uses
 * (useCustomerOptions/useCustomerCascade, both in `src/hooks/`) — never a new
 * fetch site (§11). Kept as its OWN hook rather than folded into
 * useMatchContract: customer_id/customer_location_id/customer_department_id
 * are not part of that hook's typed MatchContract shape, and merging them in
 * would let a client-only save silently null the six contract fields.
 *
 * Save is two-step (DECISIONS K-281, CMBE GO 05-09): requestSave only opens
 * the confirm step; the PATCH itself fires from confirmSave. A failed save
 * restores the draft to the match's current values and surfaces the server
 * message — never leaves a picker showing an attempted-but-unsaved pick.
 *
 * K-281 repair pass (manager, Opus reject):
 * - NOTE (a): requestSave is a no-op (just closes the editor) when the draft
 *   triplet equals the seeded original — nothing to confirm or PATCH.
 * - NOTE (b): a department option shown WITHOUT a chosen location carries its
 *   own location's name in the label ("IC · Hoofdvestiging") so duplicate
 *   department names across sites stay distinguishable.
 * - NOTE (c): while the cascade fetch for the picker is still loading (or the
 *   site was since archived and dropped off the tenant's active list), the
 *   SEEDED id has no matching option yet — a synthetic option is injected
 *   from the match row's OWN customerLocationName/customerDepartmentName
 *   (MATCH-ORDINAL-2, mapMatch) so the trigger shows the real current name
 *   instead of a bare id. Only for the seeded id — never invented for a
 *   freshly-typed pick that genuinely has no match.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useCustomerOptions } from '@/hooks/useCustomerOptions'
import { useCustomerCascade } from '@/hooks/useCustomerCascade'
import { extractApiError } from '@/lib/extractApiError'
import type { MatchRow } from '@/types/match'

// Seed one draft id field from the match's current value — undefined/null both read as "unset".
const idOf = (v: string | number | null | undefined): string => (v != null ? String(v) : '')

// A relational option list -> { value, label } pairs (mirrors RelationsSection's own `opt`).
const opt = (arr: Array<{ id?: string | number; name?: string }>) =>
  arr.map(x => ({ value: String(x.id), label: x.name ?? '—' }))

// Prepend a synthetic fallback option built from a real name, but only once —
// never duplicate an id the fetched list already carries (NOTE c).
const withFallback = (base: Array<{ value: string; label: string }>, id: string, name: string) =>
  (id && name && !base.some(o => o.value === id)) ? [{ value: id, label: name }, ...base] : base

export function useMatchClientEdit(match: MatchRow, onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void) {
  const { t } = useTranslation(['matches'])
  const [editing, setEditing] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // NOTE (a): the seeded triplet, frozen for the life of this edit session —
  // requestSave compares the draft against it to skip a no-op confirm/PATCH.
  // Real state (not a ref): several render-time computations below read it,
  // and reading a ref's `.current` during render is a React rules violation.
  const [original, setOriginal] = useState({ customerId: '', locationId: '', departmentId: '' })

  // Options only fetched while the row is actually being edited (§8 data minimization).
  const customerOptions = useCustomerOptions(editing)
  const { locations } = useCustomerCascade(customerId)
  const allDepartments = locations.flatMap(l => (l.departments ?? []).map(d => ({ ...d, locationId: l.id })))
  // Narrows to the picked location's own departments once one is chosen — mirrors useCascadePickers.
  const departments = locationId
    ? (locations.find(l => String(l.id) === locationId)?.departments ?? [])
    : allDepartments

  // NOTE (c): resolve a name for an id even when the cascade hasn't produced a
  // matching option yet — only for the SEEDED original id (never for a fresh pick).
  const resolveLocationName = (id: string): string =>
    locations.find(l => String(l.id) === id)?.name
    ?? (id && id === original.locationId ? (match.customerLocationName ?? '') : '')
  const resolveDepartmentName = (id: string): string =>
    allDepartments.find(d => String(d.id) === id)?.name
    ?? (id && id === original.departmentId ? (match.customerDepartmentName ?? '') : '')

  // NOTE (b): suffix with the owning location's name only while UNfiltered
  // (a location-scoped list already disambiguates by context). Two explicit
  // branches (not one shared .map) — `departments` (location-scoped) has no
  // `locationId` field, only `allDepartments` (the flatMap below) does.
  const departmentOptions = withFallback(
    locationId
      ? departments.map(d => ({ value: String(d.id), label: d.name ?? '—' }))
      : allDepartments.map(d => {
          const locName = locations.find(l => String(l.id) === String(d.locationId))?.name
          return { value: String(d.id), label: locName ? `${d.name ?? '—'} · ${locName}` : (d.name ?? '—') }
        }),
    departmentId, resolveDepartmentName(departmentId),
  )
  const locationOptions = withFallback(opt(locations), locationId, resolveLocationName(locationId))

  // Enter edit mode, seeded from the match's live values — never a guess (§3A no silent gambling).
  const startEdit = () => {
    const seed = { customerId: idOf(match.clientId), locationId: idOf(match.customerLocationId), departmentId: idOf(match.customerDepartmentId) }
    setOriginal(seed)
    setCustomerId(seed.customerId)
    setLocationId(seed.locationId)
    setDepartmentId(seed.departmentId)
    setError(null)
    setEditing(true)
  }
  const cancelEdit = () => { setEditing(false); setConfirmOpen(false); setError(null) }

  // Picking a new customer resets the dependent location/department (same cascade reset as useCascadePickers).
  const handleCustomerChange = (v: string) => { setCustomerId(v); setLocationId(''); setDepartmentId('') }
  const handleLocationChange = (v: string) => { setLocationId(v); setDepartmentId('') }

  // NOTE (a): an unchanged triplet just closes the editor — nothing to confirm or PATCH.
  const isDirty = customerId !== original.customerId
    || locationId !== original.locationId
    || departmentId !== original.departmentId
  const requestSave = () => {
    if (!customerId) return
    if (!isDirty) { cancelEdit(); return }
    setConfirmOpen(true)
  }
  const cancelConfirm = () => setConfirmOpen(false)

  // Resolved display names for the confirm dialog's interpolated body — PLAIN
  // names (never the NOTE b disambiguation suffix, which is picker-list-only).
  const customerName = customerOptions.find(c => String(c.value) === customerId)?.label ?? ''
  const locationName = resolveLocationName(locationId)
  const departmentName = resolveDepartmentName(departmentId)

  const confirmSave = async () => {
    setConfirmOpen(false)
    setSaving(true)
    setError(null)
    const patch = {
      customer_id: customerId,
      customer_location_id: locationId || null,
      customer_department_id: departmentId || null,
    }
    try {
      await api.patch(`/matches/${match.id}`, patch)
      // Owner, own branch and the linked vacancy are untouched server-side (the
      // confirm copy already named this); billing is re-derived from the new
      // customer server-side too — only the fields this flow actually picked
      // are patched back onto the row/header.
      //
      // K-281 repair pass 3 (Opus find): `client` is NEVER patched here — it is
      // the VACANCY's customer (backend client_name, resolved from the vacancy's
      // client_id), which this PATCH does not touch, so overwriting it with the
      // newly picked name was WRONG: the next fetch would flip it back to the
      // vacancy's customer and read as "the save did nothing". `customerName`
      // (this match's OWN customer, the field this PATCH actually changes) is
      // what gets optimistically updated instead.
      onUpdate?.(match.id, {
        clientId: customerId,
        customerName: customerName || null,
        customerLocationId: locationId || null,
        customerDepartmentId: departmentId || null,
        customerLocationName: locationName || null,
        customerDepartmentName: departmentName || null,
      })
      setEditing(false)
    } catch (err) {
      // Restore the draft to the match's CURRENT (still-saved) values so the
      // picker never keeps showing an attempt that never persisted, then
      // surface the server's reason — stays in edit mode so it's readable.
      setCustomerId(idOf(match.clientId))
      setLocationId(idOf(match.customerLocationId))
      setDepartmentId(idOf(match.customerDepartmentId))
      setError(extractApiError(err, t('drawer.clientChange.saveError')))
    } finally {
      setSaving(false)
    }
  }

  return {
    editing, startEdit, cancelEdit,
    customerId, locationId, departmentId,
    handleCustomerChange, handleLocationChange, setDepartmentId,
    customerOptions, locationOptions, departmentOptions,
    customerName, locationName, departmentName,
    confirmOpen, requestSave, cancelConfirm, confirmSave,
    saving, error,
  }
}
