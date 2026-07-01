import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { Field, TextField, SelectField } from '@/components/forms/fields'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useIndustries } from '@/lib/useIndustries'
import { useFunctions } from '@/lib/useFunctions'
import { mapVacancy } from './data/mapVacancy'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  title: 'title', status: 'status', owner_id: 'ownerId', customer_id: 'clientId',
  employment_type: 'employmentType', industry: 'industry', category: 'category', location: 'location',
}

interface VacancyForm { title: string; clientId: string; status: string; ownerId: string; employmentType: string; industry: string; category: string; location: string }
interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

/**
 * AddVacancyModal — create a vacancy. Mirrors AddCandidateModal: shared field
 * components, lookups via hooks (never hardcoded option lists), 422 mapping.
 */
export default function AddVacancyModal({ onClose, onCreated, users = [], customers = [] }: {
  onClose: () => void; onCreated?: (v: Vacancy) => void; users?: ModalUser[]; customers?: ModalCustomer[]
}) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { statuses, employmentTypes } = useVacancyLookups()
  const { industries } = useIndustries()
  const { functions } = useFunctions()

  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<VacancyForm>({
    title: '', clientId: '', status: statuses[0]?.value ?? '', ownerId: '',
    employmentType: '', industry: '', category: '', location: '',
  })

  const set = (k: keyof VacancyForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErrors({ title: true }); return }
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        status: form.status || null,
        owner_id: form.ownerId || null,
        customer_id: form.clientId || null,
        employment_type: form.employmentType || null,
        industry: form.industry || null,
        category: form.category || null,
        location: form.location || null,
      }
      const r = await api.post('/vacancies', body)
      onCreated?.(mapVacancy(r.data?.data ?? r.data))
      onClose()
    } catch (err) {
      const apiErrors = (err as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      }
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = !!form.title.trim()
  const statusOptions = statuses.map(s => ({ value: s.value, label: s.label }))
  const employmentOptions = employmentTypes.map(e => ({ value: e.value, label: e.label }))
  const userOptions = users.map(u => ({ value: String(u.id), label: u.name }))
  const customerOptions = customers.map(c => ({ value: String(c.id), label: c.name }))

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 640,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('modal.title')}</span>
          <button onClick={onClose} aria-label={t('common:cancel')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label={t('modal.fields.title')} required>
            <TextField value={form.title} onChange={v => set('title', v)} placeholder={t('modal.titlePlaceholder')} error={errors.title} />
            {errors.title && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.client')}>
              <SelectField value={form.clientId} onChange={v => set('clientId', v)} placeholder={t('common:select')} options={customerOptions} />
            </Field>
            <Field label={t('modal.fields.status')}>
              <SelectField value={form.status} onChange={v => set('status', v)} options={statusOptions} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.owner')}>
              <SelectField value={form.ownerId} onChange={v => set('ownerId', v)} placeholder={t('common:select')} options={userOptions} />
            </Field>
            <Field label={t('modal.fields.employmentType')}>
              <SelectField value={form.employmentType} onChange={v => set('employmentType', v)} placeholder={t('common:select')} options={employmentOptions} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.industry')}>
              <SelectField value={form.industry} onChange={v => set('industry', v)} placeholder={t('common:select')} options={industries} />
            </Field>
            <Field label={t('modal.fields.category')}>
              <SelectField value={form.category} onChange={v => set('category', v)} placeholder={t('common:select')} options={functions} />
            </Field>
          </div>

          <Field label={t('modal.fields.location')}>
            <TextField value={form.location} onChange={v => set('location', v)} placeholder={t('modal.fields.location')} />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8,
              border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit || saving}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: (canSubmit && !saving) ? 'var(--color-primary)' : '#E5E7EB',
              color: (canSubmit && !saving) ? 'white' : '#9CA3AF',
              cursor: (canSubmit && !saving) ? 'pointer' : 'not-allowed' }}>
            {saving ? t('modal.creating') : t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
