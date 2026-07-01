import { useState, useEffect } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, UserPlus } from 'lucide-react'
import { Field as FieldJs, TextField as TextFieldJs, SelectField as SelectFieldJs } from '@/components/forms/fields'
import { NL_PROVINCES } from './drawer/constants'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { useCreateCandidate } from './hooks/useCandidateMutations'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

// Shared form fields are still untyped JS — declare the props this modal uses (typed boundary).
const Field = FieldJs as ComponentType<{ label?: ReactNode; required?: boolean; children?: ReactNode }>
const TextField = TextFieldJs as ComponentType<{ value?: string; onChange?: (v: string) => void; placeholder?: string; type?: string; error?: boolean; style?: CSSProperties }>
const SelectField = SelectFieldJs as ComponentType<{ value?: string; onChange?: (v: string) => void; placeholder?: string; options?: Array<{ value: string; label: string } | string> }>

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  first_name: 'firstName', last_name: 'lastName', middle_name: 'middleName',
  email: 'email', phone: 'phone', function_title: 'functionTitle',
  date_of_birth: 'dateOfBirth', gender: 'gender',
  street: 'street', house_number: 'houseNumber',
  house_number_suffix: 'houseNumberSuffix', postal_code: 'postalCode',
  city: 'city', province: 'province', owner_id: 'ownerId',
}

// Lifecycle states that make sense when CREATING a candidate (not matched/inactive/etc.).
const CREATE_STATUSES = ['lead', 'candidate']

interface AppUser { id: Id; name?: string; firstname?: string; lastname?: string; [k: string]: unknown }

interface FormState {
  firstName: string; middleName: string; lastName: string; functionTitle: string
  email: string; phone: string; dateOfBirth: string; gender: string
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; city: string; province: string
  ownerId: string | number
}

interface AddCandidateModalProps {
  onClose: () => void
  onCreated?: (candidate: Candidate) => void
}

export default function AddCandidateModal({ onClose, onCreated }: AddCandidateModalProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const { phases } = useLookups() as unknown as { phases: LookupOption[] }
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { user: me } = useAuth() as unknown as { user: { id?: Id } | null }
  const settings = useAllSettings()
  const { createCandidate, saving } = useCreateCandidate()

  // On create you pick the PHASE (Lead/Kandidaat); deployability defaults to available.
  const entryStatuses = phases.filter(s => CREATE_STATUSES.includes(s.value))
  const pickStatuses  = entryStatuses.length ? entryStatuses : phases
  const defaultStatus = () => pickStatuses.find(s => s.value === 'lead')?.value ?? pickStatuses[0]?.value ?? ''

  const [status,    setStatus]    = useState(defaultStatus)
  const [errors,    setErrors]    = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    firstName: '', middleName: '', lastName: '',
    functionTitle: '',
    email: '', phone: '',
    dateOfBirth: '', gender: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '',
    // Owner defaults to the logged-in user; recruiter can change it.
    ownerId: me?.id ?? '',
  })

  // Once the real statuses arrive from the API, default to Lead if nothing chosen.
  useEffect(() => { if (!status && phases.length) setStatus(defaultStatus()) }, [phases]) // eslint-disable-line

  const set = (k: keyof FormState, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setSubmitErr(null)
  }

  // Required fields for the chosen phase (Settings → Verplichte velden), with a
  // sensible fallback. Maps the backend field keys to this form's field names.
  const REQ_FIELD_MAP: Record<string, keyof FormState> = {
    first_name: 'firstName', last_name: 'lastName', email: 'email', phone: 'phone',
    function_title: 'functionTitle', date_of_birth: 'dateOfBirth', gender: 'gender',
    street: 'street', postal_code: 'postalCode', city: 'city',
  }
  const requiredCfg = getJsonSetting<Record<string, string[]>>(settings, 'candidate_required_fields',
    { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'email', 'phone', 'function_title'] })
  const requiredForm = (requiredCfg[status] ?? requiredCfg.lead ?? []).map(k => REQ_FIELD_MAP[k]).filter(Boolean) as Array<keyof FormState>
  const isReq = (k: keyof FormState) => requiredForm.includes(k)

  const handleSubmit = async () => {
    const e: Record<string, boolean> = {}
    requiredForm.forEach(k => { if (!String(form[k] ?? '').trim()) e[k] = true })
    if (Object.keys(e).length) { setErrors(e); return }

    setSubmitErr(null)
    try {
      const body = {
        first_name:          form.firstName.trim(),
        middle_name:         form.middleName.trim() || null,
        last_name:           form.lastName.trim(),
        function_title:      form.functionTitle.trim() || null,
        email:               form.email || null,
        phone:               form.phone || null,
        date_of_birth:       form.dateOfBirth || null,
        gender:              form.gender || null,
        street:              form.street || null,
        house_number:        form.houseNumber || null,
        house_number_suffix: form.houseNumberSuffix || null,
        postal_code:         form.postalCode || null,
        city:                form.city || null,
        province:            form.province || null,
        owner_id:            form.ownerId || null,
        phase:               status || 'lead',
        status:              'available',
        candidate_types:     [],
      }
      // Create via the hook; it rethrows so the 422 handling below still runs.
      onCreated?.(await createCandidate(body))
      onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses.
      const ex = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } }; message?: string }
      const apiErrors = ex?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        // Fallback: show the server message or a generic error so the user isn't left guessing.
        const msg = ex?.response?.data?.message ?? ex?.message ?? t('common:errorGeneric', 'Er is iets misgegaan')
        setSubmitErr(msg)
      }
    }
  }

  const selectedStatus = phases.find(s => s.value === status)
  const canSubmit      = !!status && requiredForm.every(k => String(form[k] ?? '').trim())
  const statusLabel    = selectedStatus?.label ?? ''

  const genderOptions = [
    { value: 'male',   label: t('modal.gender.male') },
    { value: 'female', label: t('modal.gender.female') },
    { value: 'other',  label: t('modal.gender.other') },
  ]

  // Build owner dropdown from users list.
  const ownerOptions = users.map(u => ({ value: String(u.id), label: u.name ?? `${u.firstname} ${u.lastname}`.trim() }))

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 900,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', maxHeight: '90vh' }}>

        {/* ── Left panel: status (lifecycle) selection ── */}
        <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
          background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '20px 20px 14px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('modal.statusPanelTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{t('modal.statusPanelHint')}</div>
          </div>

          <div style={{ padding: '4px 12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pickStatuses.map(s => {
              const active = status === s.value
              return (
                <button key={s.value} onClick={() => { setStatus(s.value); setErrors({}) }}
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
            <button onClick={onClose} aria-label={t('common:close')}
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
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t('modal.noTypeSelected')}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{t('modal.chooseType')}</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Name row — first / middle / last */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12 }}>
                  <Field label={t('modal.fields.firstName')} required={isReq('firstName')}>
                    <TextField value={form.firstName} onChange={v => set('firstName', v)} placeholder={t('modal.fields.firstName')} error={errors.firstName} />
                    {errors.firstName && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('common:required')}</div>}
                  </Field>
                  <Field label={t('modal.fields.middleName')}>
                    <TextField value={form.middleName} onChange={v => set('middleName', v)} placeholder="van" />
                  </Field>
                  <Field label={t('modal.fields.lastName')} required={isReq('lastName')}>
                    <TextField value={form.lastName} onChange={v => set('lastName', v)} placeholder={t('modal.fields.lastName')} error={errors.lastName} />
                    {errors.lastName && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('common:required')}</div>}
                  </Field>
                </div>

                {/* Function + owner */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.functionTitle')} required={isReq('functionTitle')}>
                    <TextField value={form.functionTitle} onChange={v => set('functionTitle', v)} placeholder={t('modal.fields.functionPlaceholder')} error={errors.functionTitle} />
                  </Field>
                  <Field label={t('modal.fields.owner')}>
                    <SelectField value={String(form.ownerId)} onChange={v => set('ownerId', v)}
                      placeholder={t('common:select')} options={ownerOptions} />
                  </Field>
                </div>

                {/* Contact */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.email')} required={isReq('email')}>
                    <TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder={t('modal.fields.emailPlaceholder')} error={errors.email} />
                  </Field>
                  <Field label={t('modal.fields.phone')} required={isReq('phone')}>
                    <TextField type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder={t('modal.fields.phonePlaceholder')} error={errors.phone} />
                  </Field>
                </div>

                {/* Personal */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={t('modal.fields.dob')} required={isReq('dateOfBirth')}>
                    <TextField type="date" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} error={errors.dateOfBirth} />
                  </Field>
                  <Field label={t('modal.fields.gender')} required={isReq('gender')}>
                    <SelectField value={form.gender} onChange={v => set('gender', v)} placeholder={t('common:select')} options={genderOptions} />
                  </Field>
                </div>

                {/* Address */}
                <Field label={t('modal.fields.street')} required={isReq('street')}>
                  <TextField value={form.street} onChange={v => set('street', v)} placeholder={t('modal.fields.streetPlaceholder')} error={errors.street} />
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
                  <Field label={t('modal.fields.postalCode')} required={isReq('postalCode')}>
                    <TextField value={form.postalCode} onChange={v => set('postalCode', v)} error={errors.postalCode} />
                  </Field>
                  <Field label={t('modal.fields.city')} required={isReq('city')}>
                    <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} error={errors.city} />
                  </Field>
                </div>
                <Field label={t('modal.fields.province')}>
                  <SelectField value={form.province} onChange={v => set('province', v)} placeholder={t('common:select')} options={NL_PROVINCES} />
                </Field>

              </div>
            )}
          </div>

          {/* General submit error (non-422 responses) */}
          {submitErr && (
            <div style={{ margin: '0 24px 8px', padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
              {submitErr}
            </div>
          )}

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
