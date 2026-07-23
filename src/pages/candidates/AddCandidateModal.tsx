/**
 * AddCandidateModal — the "+ Kandidaat" create form (Danny's Optie A, 2026-07-18).
 * Left: the phase column (Lead/Kandidaat), untouched. Right: a two-column grid of
 * titled cards (Persoonlijk / Contact / Werk / Adres) in the drill-down ProfileTab
 * card style, replacing the old single stacked column. The address card is
 * always open (Danny r2: popup groter, geen inklap); functietitel/geslacht/
 * provincie are searchable comboboxen mirroring the drill-down, and Esc closes
 * via the house focus trap. State keys, validation, submit body and 422
 * handling are unchanged.
 *
 * Thin container (refactor 2026-07-20): each titled card is a presentational
 * component under `addmodal/` (props in, callbacks out); this file owns state,
 * validation and the submit/422 logic.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus } from 'lucide-react'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { useUsers } from '@/lib/queries'
import { useGenders } from '@/lib/useGenders'
import { useAuth } from '@/context/AuthContext'
import { useCreateCandidate } from './hooks/useCandidateMutations'
import { useLocations } from '@/lib/useLocations'
import { useFunctions } from '@/lib/useFunctions'
import { useProvinces } from '@/hooks/useProvinces'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { BTN_H } from '@/config/buttonMetrics'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'
import ModalHeader from './addmodal/ModalHeader'
import PersonalCard from './addmodal/PersonalCard'
import ContactCard from './addmodal/ContactCard'
import WorkCard from './addmodal/WorkCard'
import AddressCard from './addmodal/AddressCard'
import BranchesCard from './addmodal/BranchesCard'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  first_name: 'firstName', last_name: 'lastName', middle_name: 'middleName',
  email: 'email', phone: 'phone', mobile: 'mobile', function_title: 'functionTitle',
  date_of_birth: 'dateOfBirth', gender: 'gender',
  street: 'street', house_number: 'houseNumber',
  house_number_suffix: 'houseNumberSuffix', postal_code: 'postalCode',
  city: 'city', province: 'province', country: 'country', owner_id: 'ownerId',
}

// Lifecycle states that make sense when CREATING a candidate (not matched/inactive/etc.).
const CREATE_STATUSES = ['lead', 'candidate']

interface AppUser { id: Id; name?: string; firstname?: string; lastname?: string; [k: string]: unknown }

// Exported so the addmodal/ card components share this exact shape (type-only import).
export interface FormState {
  firstName: string; middleName: string; lastName: string; functionTitle: string
  email: string; phone: string; mobile: string; dateOfBirth: string; gender: string
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; city: string; province: string
  // COUNTRY-1: home-address country (ISO-2 code, empty until picked).
  country: string
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
  const { user: me } = useAuth() as unknown as { user: { id?: Id; branch_ids?: Array<string | number> } | null }
  const settings = useAllSettings()
  const { genders } = useGenders()
  // Zoekbare comboboxen (Danny r2): functietitel uit de functies-lookup (free-entry-
  // toggle bepaalt of typen een nieuwe waarde mag opleveren), provincies uit de lookup.
  const { functions, allowFreeEntry } = useFunctions() as { functions: Array<string | { value: string; label: string }>; allowFreeEntry: boolean }
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
    email: '', phone: '', mobile: '',
    dateOfBirth: '', gender: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '', country: '',
    // Owner defaults to the logged-in user; recruiter can change it.
    ownerId: me?.id ?? '',
  })

  // Once the real statuses arrive from the API, default to Lead if nothing chosen.
  useEffect(() => { if (!status && phases.length) setStatus(defaultStatus()) }, [phases]) // eslint-disable-line

  // Province list CASCADES on the picked country (Danny addendum) — its own cache
  // slot per country (useProvinces), so switching country never leaks another
  // country's list in. If the country changes and the currently filled province no
  // longer exists in the new list, clear it rather than silently keep a mismatch.
  const { provinces } = useProvinces(form.country)
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) setForm(f => ({ ...f, province: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

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
        // Split field (BE 2026-07-20): mobile is validated separately from the
        // landline `phone` on CandidateProfileRequest — same body key the drawer's
        // buildCandidatePatch already maps (candidatesShared.ts).
        mobile:              form.mobile || null,
        date_of_birth:       form.dateOfBirth || null,
        gender:              form.gender || null,
        street:              form.street || null,
        house_number:        form.houseNumber || null,
        house_number_suffix: form.houseNumberSuffix || null,
        postal_code:         form.postalCode || null,
        city:                form.city || null,
        province:            form.province || null,
        // COUNTRY-1: only rides along when actually picked (mirrors every other optional field).
        country:             form.country || null,
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
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 1060,
        // 940/90vh forced an inner scroll on a normal screen (Danny 23-07: "klein
        // stukje groter zodat je niet hoeft te scrollen") — wider + taller cap.
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', maxHeight: '94vh' }}>

        {/* ── Form panel — full width; the phase choice is a compact segmented row in
            the header (Danny r2: de linkerkolom verspilde ~260px aan twee knoppen) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          <ModalHeader status={status} pickStatuses={pickStatuses} selectedStatus={selectedStatus} statusLabel={statusLabel}
            onSelectStatus={v => { setStatus(v); setErrors({}) }} onClose={onClose} />

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
              // Each card is a presentational component under addmodal/ (§refactor 2026-07-20).
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
                <PersonalCard form={form} errors={errors} set={set} isReq={isReq} genderOptions={genderOptions} />
                <ContactCard form={form} errors={errors} set={set} isReq={isReq} />
                <WorkCard form={form} set={set} isReq={isReq} allowFreeEntry={allowFreeEntry} functions={functions} ownerOptions={ownerOptions} />
                <AddressCard form={form} errors={errors} set={set} isReq={isReq} provinces={provinces} />
                <BranchesCard branchIds={branchIds} setBranchIds={setBranchIds} locations={locations} />
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
