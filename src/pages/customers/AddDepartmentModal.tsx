/**
 * AddDepartmentModal — create (or edit, via `initial`) a department. Full field set
 * CustomerDepartmentController accepts: location (required — a department always
 * lives under a location), name, description, status, cost centre (Danny 2026-07-22
 * — the middle afdeling>locatie>klant cascade level; no billing email here, that
 * stays customer-only, see OverviewTab). One component serves both the top-level
 * Afdelingen tab AND the location detail's nested list (Danny: "reuse the same
 * components, don't fork") — `lockLocation` hides the location picker when
 * creating one scoped to a specific location (it's implied, not user-chosen there).
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building } from 'lucide-react'
import { Field, TextField, SelectField } from '@/components/forms/fields'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { BTN_H } from '@/config/buttonMetrics'
import type { DepartmentPayload } from './hooks/useCustomerDepartments'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'
import type { LookupOption } from '@/types/common'

interface LocationOption { id: Id; name: string }

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
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={15} color="#8B5CF6" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? t('subModal.editDepartment') : t('subModal.addDepartment')}</div>
              {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Field label={t('subModal.departmentName')} required>
              <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('subModal.departmentPlaceholder')} error={errors.name} />
            </Field>
            {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
          </div>

          {showLocationPicker && (
            <div>
              <Field label={t('subModal.selectLocation')} required>
                {locations.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--color-warning)', padding: '8px 11px', border: '1px solid var(--color-warning)', borderRadius: 8, background: 'var(--color-warning-bg)' }}>
                    {t('subModal.noLocationsFirst')}
                  </div>
                ) : (
                  <SelectField value={String(form.locationId)} onChange={v => set('locationId', v)}
                    options={locations.map(l => ({ value: String(l.id), label: l.name }))} />
                )}
              </Field>
              {errors.locationId && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
            </div>
          )}

          <div>
            {/* Rich-text prose (Danny 2026-07-14 house rule) — the editor replaces the
                textarea here (form context, no separate pencil); read mode renders it
                via SafeHtml (DepartmentDetail's Omschrijving block). */}
            <Field label={t('subModal.description')}>
              <RichTextEditor value={form.description} onChange={v => set('description', v)} />
            </Field>
          </div>

          <div>
            <Field label={t('subModal.status')}>
              <SelectField value={form.statusId ? String(form.statusId) : ''} onChange={v => set('statusId', v || null)} placeholder={t('subModal.selectStatus')} options={statusOptions} />
            </Field>
          </div>

          {/* Kostenplaats (Danny 2026-07-22) — reuses the shared subModal.costCenter
              label (same field as AddLocationModal, one translation source). */}
          <div>
            <Field label={t('subModal.costCenter')}>
              <TextField value={form.costCenter} onChange={v => set('costCenter', v)} />
            </Field>
          </div>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {createError}
          </div>
        )}

        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: canSubmit ? 'var(--color-primary)' : '#E5E7EB', color: canSubmit ? 'white' : '#9CA3AF', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
