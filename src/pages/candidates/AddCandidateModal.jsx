import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, UserPlus } from 'lucide-react'
import api from '../../lib/api'
import { Field, TextField, SelectField } from '../../components/forms/fields'
import { NL_PROVINCES } from './drawer/constants'
import { useLookups } from '../../context/LookupsContext'
import { mapCandidate } from './data/mapCandidate'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM = {
  first_name: 'firstName', last_name: 'lastName', email: 'email', phone: 'phone',
  date_of_birth: 'dateOfBirth', gender: 'gender', city: 'city', province: 'province',
  street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix', postal_code: 'postalCode',
}

// Lifecycle states that make sense when CREATING a candidate (not matched/inactive/etc.).
const CREATE_STATUSES = ['lead', 'candidate']

export default function AddCandidateModal({ onClose, onCreated }) {
  const { t } = useTranslation(['candidates', 'common'])
  // A new candidate enters on the STATUS axis (lifecycle), not the funnel — the
  // funnel lives on an application. Default to Lead (decision 14); the funnel is
  // created later by coupling to a vacancy.
  const { statuses } = useLookups()
  // Only sensible entry statuses are pickable on create; fall back to all while the
  // lookup hasn't been reseeded yet (defensive, so the picker is never empty).
  const entryStatuses = statuses.filter(s => CREATE_STATUSES.includes(s.value))
  const pickStatuses  = entryStatuses.length ? entryStatuses : statuses
  const defaultStatus = () => pickStatuses.find(s => s.value === 'lead')?.value ?? pickStatuses[0]?.value ?? ''
  const [status,  setStatus]  = useState(defaultStatus)
  const [errors,  setErrors]  = useState({})
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    dateOfBirth: '', gender: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '',
  })

  // Once the real statuses arrive from the API, default to Lead if nothing chosen.
  useEffect(() => { if (!status && statuses.length) setStatus(defaultStatus()) }, [statuses]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
  }

  const selectStatus = (id) => { setStatus(id); setErrors({}) }

  const handleSubmit = async () => {
    const e = {}
    if (!form.firstName.trim()) e.firstName = true
    if (!form.lastName.trim())  e.lastName  = true
    if (Object.keys(e).length) { setErrors(e); return }

    setSaving(true)
    try {
      // No funnel_type on the candidate — the funnel is per application. Contract
      // type(s) are set later in the drawer; a new candidate starts on its status.
      const body = {
        first_name:   form.firstName.trim(),
        last_name:    form.lastName.trim(),
        email:        form.email || null,
        phone:        form.phone || null,
        date_of_birth: form.dateOfBirth || null,
        gender:       form.gender || null,
        street:              form.street || null,
        house_number:        form.houseNumber || null,
        house_number_suffix: form.houseNumberSuffix || null,
        postal_code:         form.postalCode || null,
        city:         form.city || null,
        province:     form.province || null,
        status:       status || 'lead',
        candidate_types: [],
      }
      const r = await api.post('/candidates', body)
      onCreated?.(mapCandidate(r.data?.data ?? r.data))
      onClose()
    } catch (err) {
      const apiErrors = err?.response?.data?.errors
      if (apiErrors) {
        const e2 = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedStatus = statuses.find(s => s.value === status)
  const canSubmit      = !!status && form.firstName.trim() && form.lastName.trim()
  const statusLabel    = selectedStatus ? selectedStatus.label : ''

  const genderOptions = [
    { value: 'male',   label: t('modal.gender.male') },
    { value: 'female', label: t('modal.gender.female') },
    { value: 'other',  label: t('modal.gender.other') },
  ]

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 860,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', maxHeight: '90vh' }}>

        {/* ── Left panel: status (lifecycle) selection ── */}
        <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)',
          background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '20px 20px 14px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('modal.statusPanelTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{t('modal.statusPanelHint')}</div>
          </div>

          <div style={{ padding: '4px 12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pickStatuses.map(s => {
              const active = status === s.value
              return (
                <button key={s.value} onClick={() => selectStatus(s.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    border: `1.5px solid ${active ? s.color : 'var(--border)'}`,
                    background: active ? s.color + '14' : 'var(--surface)',
                    boxShadow: active ? `0 0 0 2px ${s.color}22` : 'none' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? s.color : 'var(--text)' }}>{s.label}</div>
                </button>
              )
            })}
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ padding: '0 12px 16px' }}>
            <button onClick={onClose}
              style={{ width: '100%', padding: '8px 0', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {t('common:cancel')}
            </button>
          </div>
        </div>

        {/* ── Right panel: candidate form ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {selectedStatus ? `${t('modal.newPrefix')} — ${statusLabel}` : t('modal.candidateData')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {status ? t('modal.fillRequired') : t('modal.selectTypeLeft')}
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {!status ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--hover-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={22} color="var(--text-muted)" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>{t('modal.noTypeSelected')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('modal.chooseType')}</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.firstName')} required>
                    <TextField value={form.firstName} onChange={v => set('firstName', v)} placeholder={t('modal.fields.firstName')} error={errors.firstName} />
                    {errors.firstName && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('common:required')}</div>}
                  </Field>
                  <Field label={t('modal.fields.lastName')} required>
                    <TextField value={form.lastName} onChange={v => set('lastName', v)} placeholder={t('modal.fields.lastName')} error={errors.lastName} />
                    {errors.lastName && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('common:required')}</div>}
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.email')}>
                    <TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder={t('modal.fields.emailPlaceholder')} />
                  </Field>
                  <Field label={t('modal.fields.phone')}>
                    <TextField type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder={t('modal.fields.phonePlaceholder')} />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.dob')}>
                    <TextField type="date" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} />
                  </Field>
                  <Field label={t('modal.fields.gender')}>
                    <SelectField value={form.gender} onChange={v => set('gender', v)} placeholder={t('common:select')} options={genderOptions} />
                  </Field>
                </div>

                <Field label={t('modal.fields.street')}>
                  <TextField value={form.street} onChange={v => set('street', v)} placeholder={t('modal.fields.streetPlaceholder')} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.houseNumber')}>
                    <TextField value={form.houseNumber} onChange={v => set('houseNumber', v)} />
                  </Field>
                  <Field label={t('modal.fields.houseNumberSuffix')}>
                    <TextField value={form.houseNumberSuffix} onChange={v => set('houseNumberSuffix', v)} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.postalCode')}>
                    <TextField value={form.postalCode} onChange={v => set('postalCode', v)} />
                  </Field>
                  <Field label={t('modal.fields.city')}>
                    <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} />
                  </Field>
                </div>
                <Field label={t('modal.fields.province')}>
                  <SelectField value={form.province} onChange={v => set('province', v)} placeholder={t('common:select')} options={NL_PROVINCES} />
                </Field>
              </div>
            )}
          </div>

          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
            <button onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              {t('common:cancel')}
            </button>
            <button onClick={handleSubmit} disabled={!canSubmit || saving}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                background: (canSubmit && !saving) ? 'var(--color-primary)' : 'var(--border)',
                color: (canSubmit && !saving) ? 'white' : 'var(--text-muted)',
                cursor: (canSubmit && !saving) ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
              {saving ? t('common:saving', 'Opslaan…') : selectedStatus ? t('modal.create', { type: statusLabel }) : t('modal.createGeneric')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
