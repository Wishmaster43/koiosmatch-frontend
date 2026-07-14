import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { Field, TextField, SelectField, DateField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAuth } from '@/context/AuthContext'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { useOpportunityServiceTypes, useOpportunityAgreementTypes } from '@/lib/useOpportunityLookups'
import { useCustomerCascade } from './hooks/useCustomerCascade'
import { mapOpportunity } from './data/mapOpportunity'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  title: 'title', customer_id: 'clientId', opportunity_stage_id: 'stageId',
  service_type_id: 'serviceTypeId', agreement_type_id: 'agreementTypeId',
  value: 'value', hours: 'hours', start_date: 'startDate', end_date: 'endDate',
  expected_close_at: 'expectedCloseAt', owner_id: 'ownerId',
  // NOTE: `location_id` on the API is the TENANT's own branch (mirrors Match's
  // branch_id), not the customer's location — sending our customer-location pick
  // under that key 422s ("exists:locations,id"). `customer_location_id` (OPP-LOC-1)
  // is the real, validated column for the customer's own location/site.
  customer_location_id: 'locationId', department_id: 'departmentId', contact_id: 'contactId',
}

interface OppForm {
  title: string; clientId: string; stageId: string; serviceTypeId: string; agreementTypeId: string
  value: string; hours: string; startDate: string; endDate: string; expectedCloseAt: string; ownerId: string
}
interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

/**
 * AddOpportunityModal — create OR edit a Kans (Danny 2026-07-14: an edit pencil
 * per row in the customer drawer's Kansen tab reuses this same modal — mirrors
 * AddLocationModal doubling as create+edit). Pass `existing` to prefill every
 * field (incl. the customer cascade) and submit a PATCH instead of a POST; the
 * `onCreated` callback fires on both a successful create AND a successful edit.
 * Shared field components, lookups via hooks (never hardcoded option lists), 422
 * mapping. The stage/service/agreement selects key on the lookup id (the writes
 * expect *_id) — `stageId` is resolved from `existing.stageValue` once the tenant
 * stage lookup loads, since Opportunity only carries the stage's stable `value`.
 */
export default function AddOpportunityModal({ onClose, onCreated, users = [], customers = [], defaultCustomerId, existing }: {
  onClose: () => void; onCreated?: (o: Opportunity) => void; users?: ModalUser[]; customers?: ModalCustomer[]
  // Pre-fill the client when opened from a customer's own drawer (Kansen tab) —
  // minimal addition, the picker still shows so the field never silently locks
  // out a correction; keep prop-driven (no hardcoded id) per §3A.
  defaultCustomerId?: Id
  // Edit mode: the Kans being edited. Present ⇒ PATCH /opportunities/{id}, absent ⇒ POST /opportunities.
  existing?: Opportunity
}) {
  const { t } = useTranslation(['opportunities', 'common'])
  const isEdit = Boolean(existing)
  const { stages } = useOpportunityStages()
  const { serviceTypes }   = useOpportunityServiceTypes()
  const { agreementTypes } = useOpportunityAgreementTypes()
  // Owner defaults to the logged-in user (still changeable below).
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }

  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<OppForm>({
    title: existing?.title ?? '',
    clientId: existing ? String(existing.clientId ?? '') : (defaultCustomerId != null ? String(defaultCustomerId) : ''),
    // Stage id can't be resolved yet (Opportunity only carries the stable `value`,
    // not the lookup id) — the effect below fills it in once `stages` has loaded.
    stageId: '',
    serviceTypeId: existing?.serviceTypeId != null ? String(existing.serviceTypeId) : '',
    agreementTypeId: existing?.agreementTypeId != null ? String(existing.agreementTypeId) : '',
    value: existing?.value != null ? String(existing.value) : '',
    hours: existing?.hours != null ? String(existing.hours) : '',
    startDate: existing?.startDate ?? '', endDate: existing?.endDate ?? '', expectedCloseAt: existing?.expectedCloseAt ?? '',
    ownerId: existing?.ownerId != null ? String(existing.ownerId) : (me?.id != null ? String(me.id) : ''),
  })

  // Resolve the stage id from the existing deal's stable `value` once the REAL
  // tenant stage lookup has loaded. BUG (found via probe, 2026-07-14): the seed
  // fallback (DEFAULT_OPPORTUNITY_STAGES) carries no `id` — an earlier version of
  // this effect matched against it first and wrote the bare slug into `stageId`
  // ("qualified"), then a truthiness guard ("already set, skip") blocked the
  // LATER real match (with the actual uuid) from ever overwriting it — so once
  // the tenant lookup replaced the seed, `stageId` no longer matched any option's
  // value and the Fase select silently reverted to unselected (Danny would have
  // shipped a save that WIPED the existing stage). Only accept an id-bearing
  // match, so the seed pass is a no-op and the real pass is the only one that writes.
  useEffect(() => {
    if (!existing?.stageValue) return
    const match = stages.find(s => s.value === existing.stageValue)
    if (match?.id) setForm(f => (f.stageId === String(match.id) ? f : { ...f, stageId: String(match.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages])

  // Klant → locatie → afdeling → contactpersoon cascade (mirrors MatchPlacementModal).
  // All three stay optional; picking a different client resets the dependent picks.
  const [locationId,   setLocationId]   = useState(existing?.locationId != null ? String(existing.locationId) : '')
  const [departmentId, setDepartmentId] = useState(existing?.departmentId != null ? String(existing.departmentId) : '')
  const [contactId,    setContactId]    = useState(existing?.contactId != null ? String(existing.contactId) : '')
  const { locations, contacts } = useCustomerCascade(form.clientId)
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []

  const set = (k: keyof OppForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
  }
  const handleClientChange = (v: string) => {
    set('clientId', v)
    setLocationId(''); setDepartmentId(''); setContactId('')
  }
  const handleLocationChange = (v: string) => { setLocationId(v); setDepartmentId('') }

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
        // customer_location_id (OPP-LOC-1) — the customer's own location/site.
        customer_location_id: locationId || null,
        department_id: departmentId || null,
        contact_id: contactId || null,
      }
      const r = existing
        ? await api.patch(`/opportunities/${existing.id}`, body)
        : await api.post('/opportunities', body)
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
  // The logged-in user may not be part of the assignable `users` list (e.g. a
  // tenant admin); inject them so the "defaults to me" owner pick is actually
  // visible in the dropdown, not just held in state (mirrors OpportunityDrawer's
  // ownerOptions fallback for the same reason).
  const meInUsers = me?.id != null && users.some(u => String(u.id) === String(me.id))
  const userOptions = [
    ...(me?.id != null && !meInUsers ? [{ value: String(me.id), label: me.name ?? '' }] : []),
    ...users.map(u => ({ value: String(u.id), label: u.name })),
  ]
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
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? t('modal.editTitle') : t('modal.title')}</span>
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
              {/* Searchable, pick-only (allowCreate=false) — same house pattern as
                  AddMatchModal/AddApplicationModal's PickField for a large option list. */}
              <CreatableSelect allowCreate={false} value={form.clientId || null} onChange={handleClientChange}
                placeholder={t('common:select')} options={customerOptions} />
            </Field>
            <Field label={t('modal.fields.stage')}>
              <SelectField value={form.stageId} onChange={v => set('stageId', v)} placeholder={t('common:select')} options={stageOptions} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('modal.fields.location')}>
              <SelectMenu value={locationId || null} onChange={handleLocationChange}
                placeholder={form.clientId ? t('common:select') : t('pickClientFirst')}
                options={locations.map(l => ({ value: String(l.id), label: l.name ?? '—' }))} />
            </Field>
            <Field label={t('modal.fields.department')}>
              <SelectMenu value={departmentId || null} onChange={setDepartmentId}
                placeholder={form.clientId ? t('common:select') : t('pickClientFirst')}
                options={departments.map(d => ({ value: String(d.id), label: d.name ?? '—' }))} />
            </Field>
          </div>

          <Field label={t('modal.fields.contact')}>
            <SelectMenu value={contactId || null} onChange={setContactId}
              placeholder={form.clientId ? t('common:select') : t('pickClientFirst')}
              options={contacts.map(c => ({ value: String(c.id), label: c.name ?? '—' }))} />
          </Field>

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
            {isEdit
              ? (saving ? t('modal.saving') : t('modal.save'))
              : (saving ? t('modal.creating') : t('modal.create'))}
          </button>
        </div>
      </div>
    </div>
  )
}
