/**
 * AddDepartmentModal — create (or edit, via `initial`) a department. Full field set
 * CustomerDepartmentController accepts: location (required — a department always
 * lives under a location), name, description, status. One component serves both the
 * top-level Afdelingen tab AND the location detail's nested list (Danny: "reuse the
 * same components, don't fork") — `lockLocation` hides the location picker when
 * creating one scoped to a specific location (it's implied, not user-chosen there).
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building } from 'lucide-react'
import { Field, TextField, SelectField } from '@/components/forms/fields'
import RichTextEditor from '@/components/ui/RichTextEditor'
import type { DepartmentPayload } from './hooks/useCustomerDepartments'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'
import type { LookupOption } from '@/types/common'

interface LocationOption { id: Id; name: string }

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
  const { t } = useTranslation('customers')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const isEdit = Boolean(initial)
  const [form, setForm] = useState<DepartmentPayload>({
    name: initial?.name ?? '',
    locationId: initial?.locationId ?? lockLocationId ?? locations[0]?.id ?? '',
    description: initial?.description ?? '',
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
  })
  const [error, setError] = useState(false)
  const set = <K extends keyof DepartmentPayload>(k: K, v: DepartmentPayload[K]) => { setForm(f => ({ ...f, [k]: v })); if (k === 'name' || k === 'locationId') setError(false) }

  const submit = () => {
    if (!form.name.trim() || !form.locationId) { setError(true); return }
    onCreate?.({ ...form, name: form.name.trim() })
    onClose()
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
              <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('subModal.departmentPlaceholder')} error={error && !form.name.trim()} />
            </Field>
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
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: canSubmit ? 'var(--color-primary)' : '#E5E7EB', color: canSubmit ? 'white' : '#9CA3AF', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
