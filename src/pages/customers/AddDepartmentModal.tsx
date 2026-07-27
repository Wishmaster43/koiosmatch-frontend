/**
 * AddDepartmentModal — create (or edit, via `initial`) a department. Full field set
 * CustomerDepartmentController accepts: location (required — a department always
 * lives under a location), name, description, status, cost centre (Danny 2026-07-22
 * — the middle afdeling>locatie>klant cascade level; no billing email here, that
 * stays customer-only, see OverviewTab). One component serves both the top-level
 * Afdelingen tab AND the location detail's nested list (Danny: "reuse the same
 * components, don't fork") — `lockLocation` hides the location picker when
 * creating one scoped to a specific location (it's implied, not user-chosen there).
 *
 * Widened to the house "wide form" frame (Danny 27-07: "+ afdeling ook nalopen!" —
 * every create modal must match +Match/+Kandidaat's footprint) via the shared
 * WIDE_MODAL constant, and regrouped into titled, bordered cards (Algemeen/
 * Zakelijk/Omschrijving) stacked full-width — mirrors AddContactPersonModal.tsx /
 * AddLocationModal.tsx (same folder, same 27-07 request) so the "customers"
 * sub-modals read as one system. The location + status pickers become searchable
 * CreatableSelects (allowCreate={false} — real relational ids, never a free-text
 * create). This entity genuinely has fewer fields than Location (5 vs 13), so its
 * cards stay lighter — see report re: not padding the layout with empty space.
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building } from 'lucide-react'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import type { DepartmentPayload } from './hooks/useCustomerDepartments'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'
import type { LookupOption } from '@/types/common'

interface LocationOption { id: Id; name: string }

// Card chrome — mirrors AddContactPersonModal/AddLocationModal exactly (§3A):
// 11px uppercase muted heading over a bordered surface, kept local (not a
// cross-import — CLAUDE.md §2: an entity page must not reach into another
// entity's internals) so it matches the sibling modals verbatim.
const cardHead = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
const cardBox = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 12 }
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
// Even 3-across — used to constrain a SINGLE field (status, or cost centre) to
// roughly a third of the panel width instead of letting it stretch the full
// 1060px row (this entity has too few fields per card to fill a wide row).
const row3Even = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  name: 'name', location_id: 'locationId', description: 'description', status_id: 'statusId',
  cost_center: 'costCenter',
}

export default function AddDepartmentModal({ onClose, onCreate, locations = [], customerName, statuses = [], initial, lockLocationId }: {
  onClose: () => void
  onCreate?: (v: DepartmentPayload) => void
  locations?: LocationOption[]
  customerName?: string
  statuses?: LookupOption[]
  initial?: Department | null
  // Pre-select + lock the location (creating "at this location" from the location detail).
  lockLocationId?: Id
}) {
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const isEdit = Boolean(initial)
  const [form, setForm] = useState<DepartmentPayload>({
    name: initial?.name ?? '',
    locationId: initial?.locationId ?? lockLocationId ?? locations[0]?.id ?? '',
    description: initial?.description ?? '',
    // Kostenplaats (Danny 2026-07-22) — the middle cascade level; settable on
    // create too, not just via the DepartmentDetail edit path.
    costCenter: initial?.costCenter ?? '',
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    customFields: initial?.customFields ?? {},
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure — only reachable on the CREATE path (see submit()).
  const [createError, setCreateError] = useState<string | null>(null)
  const set = <K extends keyof DepartmentPayload>(k: K, v: DepartmentPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  const submit = async () => {
    if (!form.name.trim() || !form.locationId) {
      setErrors({ name: !form.name.trim(), locationId: !form.locationId })
      return
    }
    const payload = { ...form, name: form.name.trim() }
    // Edit path: update() keeps its existing toast-based error handling — unchanged,
    // closes immediately.
    if (isEdit) { onCreate?.(payload); onClose(); return }
    // Create path: add() rethrows on failure (C-18) so 422 field errors land under
    // their fields here instead of a generic toast while the modal closed regardless.
    try {
      await onCreate?.(payload)
      onClose()
    } catch (err) {
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    }
  }

  const canSubmit = !!form.name.trim() && !!form.locationId
  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const showLocationPicker = !lockLocationId

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isEdit ? t('subModal.editDepartment') : t('subModal.addDepartment')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', ...WIDE_MODAL, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-violet-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={15} color="var(--color-violet)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? t('subModal.editDepartment') : t('subModal.addDepartment')}</div>
              {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Algemeen — name, locatie (searchable, hidden when locked), status.
              Location+status pair in one row when both show; status alone stays
              constrained to ~a third of the width (row3Even) rather than
              stretching a lone field across the full panel. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.general')}</div>
            <div style={cardBox}>
              <div>
                <Field label={t('subModal.departmentName')} required>
                  <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('subModal.departmentPlaceholder')} error={errors.name} />
                </Field>
                {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
              </div>

              {showLocationPicker ? (
                <div style={row2}>
                  <div>
                    <Field label={t('subModal.selectLocation')} required>
                      {locations.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--color-warning)', padding: '8px 11px', border: '1px solid var(--color-warning)', borderRadius: 8, background: 'var(--color-warning-bg)' }}>
                          {t('subModal.noLocationsFirst')}
                        </div>
                      ) : (
                        // Searchable (Danny 27-07): a customer can have many locations.
                        // The placeholder also drives the search box's accessible
                        // label (CreatableSelect's own a11y contract), not just the
                        // empty-state trigger text.
                        <CreatableSelect value={form.locationId ? String(form.locationId) : null} onChange={v => set('locationId', v)}
                          allowCreate={false} placeholder={t('subModal.selectLocation')}
                          options={locations.map(l => ({ value: String(l.id), label: l.name }))} />
                      )}
                    </Field>
                    {errors.locationId && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
                  </div>
                  <Field label={t('subModal.status')}>
                    <CreatableSelect value={form.statusId ? String(form.statusId) : null} onChange={v => set('statusId', v || null)} allowCreate={false}
                      placeholder={t('subModal.selectStatus')} options={statusOptions} />
                  </Field>
                </div>
              ) : (
                <div style={row3Even}>
                  <Field label={t('subModal.status')}>
                    <CreatableSelect value={form.statusId ? String(form.statusId) : null} onChange={v => set('statusId', v || null)} allowCreate={false}
                      placeholder={t('subModal.selectStatus')} options={statusOptions} />
                  </Field>
                </div>
              )}
            </div>
          </div>

          {/* Zakelijk — kostenplaats (Danny 2026-07-22), reuses the shared
              subModal.costCenter label (same field as AddLocationModal, one
              translation source). Its own card, same as Location's, so a future
              business field (e.g. billing) has an obvious home. */}
          <div>
            <div style={cardHead}>{t('subModal.groups.business')}</div>
            <div style={cardBox}>
              <div style={row3Even}>
                <Field label={t('subModal.costCenter')}><TextField value={form.costCenter} onChange={v => set('costCenter', v)} /></Field>
              </div>
            </div>
          </div>

          {/* Omschrijving — its own card so the rich-text editor (house rule,
              CLAUDE.md §3A) gets the room a wide panel affords; no separate Field
              label (the card heading already carries it, mirrors RemarksSection). */}
          <div>
            <div style={cardHead}>{t('subModal.description')}</div>
            <div style={cardBox}>
              {/* Rich-text prose (Danny 2026-07-14 house rule) — the editor replaces the
                  textarea here (form context, no separate pencil); read mode renders it
                  via SafeHtml (DepartmentDetail's Omschrijving block). */}
              <RichTextEditor value={form.description} onChange={v => set('description', v)} />
            </div>
          </div>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'white' : 'var(--text-muted)', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
