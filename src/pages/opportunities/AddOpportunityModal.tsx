import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { Field, TextField, SelectField, DateField } from '@/components/forms/fields'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { useOpportunityServiceTypes, useOpportunityAgreementTypes } from '@/lib/useOpportunityLookups'
import { mapOpportunity } from './data/mapOpportunity'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  title: 'title', customer_id: 'clientId', opportunity_stage_id: 'stageId',
  service_type_id: 'serviceTypeId', agreement_type_id: 'agreementTypeId',
  value: 'value', hours: 'hours', start_date: 'startDate', end_date: 'endDate',
  expected_close_at: 'expectedCloseAt', owner_id: 'ownerId',
}

interface OppForm {
  title: string; clientId: string; stageId: string; serviceTypeId: string; agreementTypeId: string
  value: string; hours: string; startDate: string; endDate: string; expectedCloseAt: string; ownerId: string
}
interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

/**
 * AddOpportunityModal — create a Kans. Mirrors AddVacancyModal: shared field
 * components, lookups via hooks (never hardcoded option lists), 422 mapping. The
 * stage/service/agreement selects key on the lookup id (the writes expect *_id).
 */
export default function AddOpportunityModal({ onClose, onCreated, users = [], customers = [] }: {
  onClose: () => void; onCreated?: (o: Opportunity) => void; users?: ModalUser[]; customers?: ModalCustomer[]
}) {
  const { t } = useTranslation(['opportunities', 'common'])
  const { stages } = useOpportunityStages()
  const { serviceTypes }   = useOpportunityServiceTypes()
  const { agreementTypes } = useOpportunityAgreementTypes()

  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<OppForm>({
    title: '', clientId: '', stageId: '', serviceTypeId: '', agreementTypeId: '',
    value: '', hours: '', startDate: '', endDate: '', expectedCloseAt: '', ownerId: '',
  })

  const set = (k: keyof OppForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErrors({ title: true }); return }
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        customer_id: form.clientId || null,
        opportunity_stage_id: form.stageId || null,
        service_type_id: form.serviceTypeId || null,
        agreement_type_id: form.agreementTypeId || null,
        value: form.value === '' ? null : Number(form.value),
        hours: form.hours === '' ? null : Number(form.hours),
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        expected_close_at: form.expectedCloseAt || null,
        owner_id: form.ownerId || null,
      }
      const r = await api.post('/opportunities', body)
      onCreated?.(mapOpportunity(r.data?.data ?? r.data))
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
  const stageOptions     = stages.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const serviceOptions   = serviceTypes.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const agreementOptions = agreementTypes.map(a => ({ value: String(a.id ?? a.value), label: a.label }))
  const userOptions      = users.map(u => ({ value: String(u.id), label: u.name }))
  const customerOptions  = customers.map(c => ({ value: String(c.id), label: c.name }))

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 560,
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
            <Field label={t('modal.fields.stage')}>
              <SelectField value={form.stageId} onChange={v => set('stageId', v)} placeholder={t('common:select')} options={stageOptions} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.serviceType')}>
              <SelectField value={form.serviceTypeId} onChange={v => set('serviceTypeId', v)} placeholder={t('common:select')} options={serviceOptions} />
            </Field>
            <Field label={t('modal.fields.agreementType')}>
              <SelectField value={form.agreementTypeId} onChange={v => set('agreementTypeId', v)} placeholder={t('common:select')} options={agreementOptions} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.value')}>
              <TextField type="number" value={form.value} onChange={v => set('value', v)} placeholder="0" error={errors.value} />
            </Field>
            <Field label={t('modal.fields.hours')}>
              <TextField type="number" value={form.hours} onChange={v => set('hours', v)} placeholder="0" error={errors.hours} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.startDate')}>
              <DateField value={form.startDate} onChange={v => set('startDate', v)} placeholder={t('common:select')} />
            </Field>
            <Field label={t('modal.fields.endDate')}>
              <DateField value={form.endDate} onChange={v => set('endDate', v)} placeholder={t('common:select')} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.owner')}>
              <SelectField value={form.ownerId} onChange={v => set('ownerId', v)} placeholder={t('common:select')} options={userOptions} />
            </Field>
            <Field label={t('modal.fields.expectedClose')}>
              <DateField value={form.expectedCloseAt} onChange={v => set('expectedCloseAt', v)} placeholder={t('common:select')} />
            </Field>
          </div>
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
