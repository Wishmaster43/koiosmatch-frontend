/**
 * AddCandidateModal — the "+ Kandidaat" create form (Danny's Optie A, 2026-07-18).
 * Left: the phase column (Lead/Kandidaat), untouched. Right: a two-column grid of
 * titled cards (Persoonlijk / Contact / Werk / Adres) in the drill-down ProfileTab
 * card style, replacing the old single stacked column. The address card is
 * always open (Danny r2: popup groter, geen inklap); functietitel/geslacht/
 * provincie are searchable comboboxen mirroring the drill-down, and Esc closes
 * via the house focus trap. State keys, validation, submit body and 422
 * handling are unchanged.
 */
import { useState, useEffect } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, UserPlus } from 'lucide-react'
import { Field as FieldJs, TextField as TextFieldJs, SelectField as SelectFieldJs } from '@/components/forms/fields'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { useUsers } from '@/lib/queries'
import { useGenders } from '@/lib/useGenders'
import { useAuth } from '@/context/AuthContext'
import { useCreateCandidate } from './hooks/useCandidateMutations'
import { useLocations } from '@/lib/useLocations'
import SearchSelect from '@/components/ui/SearchSelect'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import { useFunctions } from '@/lib/useFunctions'
import { useProvinces } from './hooks/useProvinces'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { BTN_H } from '@/config/buttonMetrics'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

// Shared form fields are still untyped JS — declare the props this modal uses (typed boundary).
const Field = FieldJs as ComponentType<{ label?: ReactNode; required?: boolean; children?: ReactNode }>
const TextField = TextFieldJs as ComponentType<{ value?: string; onChange?: (v: string) => void; placeholder?: string; type?: string; error?: boolean; style?: CSSProperties }>
const SelectField = SelectFieldJs as ComponentType<{ value?: string; onChange?: (v: string) => void; placeholder?: string; options?: Array<{ value: string; label: string } | string> }>
// Searchable combobox (drill-down pattern) — still untyped JS, same cast as ProfileTab.
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<Record<string, unknown>>

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


// Card chrome — mirrors the drill-down ProfileTab exactly (11px uppercase muted
// heading above a bordered surface card) so the modal reads as the same system (§3A).
const cardHead: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
const cardBox: CSSProperties = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }
// One-line field pairing (§3A: short fields two-up) — a grid row with the given column spec.
const row = (cols: string): CSSProperties => ({ display: 'grid', gridTemplateColumns: cols, gap: 12 })

interface AddCandidateModalProps {
  onClose: () => void
  onCreated?: (candidate: Candidate) => void
}

export default function AddCandidateModal({ onClose, onCreated }: AddCandidateModalProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const { phases } = useLookups() as unknown as { phases: LookupOption[] }
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { user: me } = useAuth() as unknown as { user: { id?: Id; branch_ids?: Array<string | number> } | null }
  const settings = useAllSettings()
  const { genders } = useGenders()
  // Zoekbare comboboxen (Danny r2): functietitel uit de functies-lookup (free-entry-
  // toggle bepaalt of typen een nieuwe waarde mag opleveren), provincies uit de lookup.
  const { functions, allowFreeEntry } = useFunctions() as { functions: Array<string | { value: string; label: string }>; allowFreeEntry: boolean }
  const { provinces } = useProvinces()
  // Esc sluit + tab-trap + focus-restore (huispatroon).
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { createCandidate, saving } = useCreateCandidate()

  // On create you pick the PHASE (Lead/Kandidaat); deployability defaults to available.
  const entryStatuses = phases.filter(s => CREATE_STATUSES.includes(s.value))
  const pickStatuses  = entryStatuses.length ? entryStatuses : phases
  // Default entry phase is flag-driven (§3B: is_default), not the hardcoded 'lead' key.
  const defaultStatus = () => pickStatuses.find(s => (s as { is_default?: boolean }).is_default)?.value ?? pickStatuses[0]?.value ?? ''

  const [status,    setStatus]    = useState(defaultStatus)
  const [errors,    setErrors]    = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  // Punt 10: vestiging-chips — voorgevuld met de eigen koppelingen uit /auth/me
  // (ME-BRANCHES-1). Leeg = veld weglaten → de backend koppelt automatisch de
  // maker-vestigingen (punt 9); een afwijkende keuze gaat expliciet mee in de
  // create-body en wint volledig (CREATE-BRANCHES-1).
  const locations = useLocations()
  const seedBranchIds = (me?.branch_ids ?? []).map(String)
  const [branchIds, setBranchIds] = useState<string[]>(seedBranchIds)
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
    // Fallback mirrors CandidateRequiredFieldsSettings' DEFAULTS (email/phone not required by default — Danny punt 3).
    { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'function_title'] })
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
        // Punt 10: only an explicit, non-empty choice rides along (explicit wins
        // server-side); empty = omit → auto-assign of the maker's branches.
        ...(branchIds.length ? { location_ids: branchIds } : {}),
      }
      // Create via the hook; it rethrows so the 422 handling below still runs.
      // Create FIRST, then notify: `onCreated?.(await …)` short-circuits the whole
      // call — argument included — when the optional prop is absent, silently
      // skipping the create itself (audit R2-M finding).
      const created = await createCandidate(body)
      onCreated?.(created)
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

  // Gender options come from the /genders tenant lookup (CFG-1), not hardcoded.
  const genderOptions = genders.map(g => ({ value: g.value, label: g.label }))

  // Build owner dropdown from the users list; make sure the logged-in default is
  // actually IN it (a super admin isn't always in the assignable list — the
  // select rendered blank while ownerId was set; mirror of the kans-modal fix).
  const ownerOptions = users.map(u => ({ value: String(u.id), label: u.name ?? `${u.firstname} ${u.lastname}`.trim() }))
  if (me?.id && !ownerOptions.some(o => o.value === String(me.id))) {
    ownerOptions.unshift({ value: String(me.id), label: (me as { name?: string }).name ?? '' })
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 940,
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
          {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
          <div style={{ padding: '0 12px 16px' }}>
            <button onClick={onClose}
              style={{ width: '100%', height: BTN_H, padding: '0', fontSize: 13, borderRadius: 8,
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
              // Two-column grid of titled cards (Optie A) — Persoonlijk/Adres span both
              // columns (their paired rows need the width); Contact/Werk sit side by side.
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>

                {/* ── Persoonlijk — name row + birthdate/gender pair ── */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={cardHead}>{t('modal.fields.cardPersonal')}</div>
                  <div style={cardBox}>
                    <div style={row('2fr 1fr 2fr')}>
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
                    <div style={row('1fr 1fr')}>
                      <Field label={t('modal.fields.dob')} required={isReq('dateOfBirth')}>
                        <TextField type="date" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} error={errors.dateOfBirth} />
                      </Field>
                      <Field label={t('modal.fields.gender')} required={isReq('gender')}>
                        <CreatableSelect value={form.gender || null} onChange={(v: string) => set('gender', v)} allowCreate={false}
                          placeholder={t('common:select')} options={genderOptions} menuWidth={220} />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* ── Contact — email + phone (half-width card, so stacked) ── */}
                <div>
                  <div style={cardHead}>{t('modal.fields.cardContact')}</div>
                  <div style={cardBox}>
                    <Field label={t('modal.fields.email')} required={isReq('email')}>
                      <TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder={t('modal.fields.emailPlaceholder')} error={errors.email} />
                    </Field>
                    <Field label={t('modal.fields.phone')} required={isReq('phone')}>
                      <TextField type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder={t('modal.fields.phonePlaceholder')} error={errors.phone} />
                    </Field>
                  </div>
                </div>

                {/* ── Werk — function + owner + branch chips ── */}
                <div>
                  <div style={cardHead}>{t('modal.fields.cardWork')}</div>
                  <div style={cardBox}>
                    <Field label={t('modal.fields.functionTitle')} required={isReq('functionTitle')}>
                      <CreatableSelect value={form.functionTitle || null} onChange={(v: string) => set('functionTitle', v)} allowCreate={allowFreeEntry}
                      placeholder={t('modal.fields.functionPlaceholder')} options={functions} menuWidth={280} />
                    </Field>
                    <Field label={t('modal.fields.owner')}>
                      <SelectField value={String(form.ownerId)} onChange={v => set('ownerId', v)}
                        placeholder={t('common:select')} options={ownerOptions} />
                    </Field>
                    {/* Vestigingen (punt 10, r2-vervolg): zelfde patroon als de drill-down's
                        BranchSection — gekozen vestigingen als chips met ×, toevoegen via de
                        zoekbare SearchSelect (niet alle opties als toggle-chips: te druk). */}
                    <Field label={t('modal.fields.branches')}>
                      {branchIds.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {branchIds.map(id => (
                            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                              borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                              {locations.find(o => String(o.value) === id)?.label ?? id}
                              <button type="button" onClick={() => setBranchIds(p => p.filter(x => x !== id))} aria-label={t('common:remove')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <SearchSelect triggerLabel={t('modal.fields.branchesAdd')}
                        options={locations.map(o => ({ value: String(o.value), label: o.label }))}
                        selected={branchIds}
                        onToggle={(id: string) => setBranchIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />
                      {branchIds.length === 0 && locations.length > 0 && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: '6px 0 0' }}>{t('modal.fields.branchesAutoHint')}</p>
                      )}
                    </Field>
                  </div>
                </div>

                {/* ── Adres — altijd open (Danny r2: popup groter, geen inklap) ── */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={cardHead}>{t('modal.fields.cardAddress')}</div>
                  <div style={cardBox}>
                    <div style={row('2fr 1fr 1fr')}>
                      <Field label={t('modal.fields.street')} required={isReq('street')}>
                        <TextField value={form.street} onChange={v => set('street', v)} placeholder={t('modal.fields.streetPlaceholder')} error={errors.street} />
                      </Field>
                      <Field label={t('modal.fields.houseNumber')}>
                        <TextField value={form.houseNumber} onChange={v => set('houseNumber', v)} />
                      </Field>
                      <Field label={t('modal.fields.houseNumberSuffix')}>
                        <TextField value={form.houseNumberSuffix} onChange={v => set('houseNumberSuffix', v)} />
                      </Field>
                    </div>
                    <div style={row('1fr 2fr')}>
                      <Field label={t('modal.fields.postalCode')} required={isReq('postalCode')}>
                        <TextField value={form.postalCode} onChange={v => set('postalCode', v)} error={errors.postalCode} />
                      </Field>
                      <Field label={t('modal.fields.city')} required={isReq('city')}>
                        <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} error={errors.city} />
                      </Field>
                    </div>
                    <div style={row('1fr 1fr')}>
                      <Field label={t('modal.fields.province')}>
                        <CreatableSelect value={form.province || null} onChange={(v: string) => set('province', v)} allowCreate={false}
                          placeholder={t('common:select')} options={provinces} menuWidth={260} />
                      </Field>
                      <div />
                    </div>
                  </div>
                </div>

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

          {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
            <button onClick={onClose}
              style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              {t('common:cancel')}
            </button>
            <button onClick={handleSubmit} disabled={!canSubmit || saving}
              style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
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
