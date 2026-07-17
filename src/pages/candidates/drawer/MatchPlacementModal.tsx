/**
 * MatchPlacementModal — the full "+ Match" form on the candidate Match tab
 * (MATCH-PLACEMENT-1, fase 1). A placement IS the Match (one record), so this
 * POSTs to /matches with the contract/financial layer. The customer→location→
 * department→contact cascade, function + contract-type dropdowns, dates/hours and
 * the purchase/sell/margin block all work now; /matches tolerates the extra fields
 * (ignored until the backend model lands, then persisted). Rates propose from a
 * price agreement / conversion factor once customer + function are picked
 * (MATCH-PLACEMENT-2, useRateProposal) — the margin is shown live. Widened to a
 * two-column 720px panel (Danny job 17); the long-list relational pickers (klant/
 * locatie/afdeling/contactpersoon/functie/vacature) are typeable searchable
 * comboboxes via the shared CreatableSelect with `allowCreate={false}` — never a
 * hardcoded free-text create for a relational id (job 18). Cost centre + billing
 * email propose from whichever picked level (afdeling > locatie > klant) carries a
 * value, and freeze the moment the recruiter edits them by hand (job 21/22).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import SelectMenu from '@/components/ui/SelectMenu'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useUsers } from '@/lib/queries'
import { useCustomerOptions } from '@/pages/vacancies/hooks/useCustomerOptions'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import { useFunctions } from '@/lib/useFunctions'
import { useContractTypes } from '@/lib/useContractTypes'
import { useRateProposal } from '../hooks/useRateProposal'
import { RateProposalHint, RateDeviationWarning } from './RateProposalNotice'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useActionRulePreflight, ActionRuleBanner } from '@/components/actionrules'
import type { Id } from '@/types/common'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 720, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '18px 0 10px' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const errMsg: React.CSSProperties = { fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }

// 422 field-error keys are snake_case; map them back to this form's field/state names.
const API_TO_FORM: Record<string, string> = {
  candidate_id: 'pickedCandidateId', customer_id: 'customerId',
  customer_location_id: 'locationId', customer_department_id: 'departmentId', contact_id: 'contactId',
  function_title: 'func', contract_type: 'contractType', start_date: 'startDate', end_date: 'endDate',
  hours_per_week: 'hours', cao: 'cao', scale: 'scale', step: 'step',
  purchase_rate: 'purchase', sell_rate: 'sell', cost_center: 'costCenter', billing_emails: 'billingEmails',
  remarks: 'remarks', vacancy_id: 'vacancyId', owner_id: 'ownerId',
}
// Consistent search-box width for the relational pickers below — the widened
// panel gives each row2 column ~330px, so a slightly wider menu than the shared
// component's 220px default reads better without overflowing it.
const pickerMenuWidth = 280

interface UserLike { id?: Id; name?: string }
// A department's OWN cost-centre/billing-email takeover default. NOT returned by
// CustomerDepartmentResource today (BE gap — see Self-Audit/report); typed
// optionally so the deepest-wins cascade below activates the moment the backend
// ships these two columns, with zero further frontend change.
interface CustomerDepartmentDetail { id?: Id; name?: string; cost_center?: string | null; billing_email?: string | null }
// Fase-3 fields: branch (vestiging) + cost-centre/billing takeover defaults per
// customer and per location — the deepest picked level (afdeling > locatie > klant)
// wins once it carries its own value (see cascadeValue below).
interface CustomerDetail {
  branch_id?: Id | null
  branch?: { id?: Id; name?: string } | null
  cost_center?: string | null
  billing_email?: string | null
  locations?: Array<{ id?: Id; name?: string; cost_center?: string | null; billing_email?: string | null; departments?: CustomerDepartmentDetail[] }>
  contacts?: Array<{ id?: Id; name?: string }>
}

// Deepest-first takeover-default lookup for one field (afdeling > locatie > klant):
// returns whichever picked level carries a non-empty value, else ''. Department-
// level values are simply undefined until the BE ships the columns, so this
// silently falls through to location/customer — no special-casing needed here.
function cascadeValue(detail: CustomerDetail | null, locationId: string, departmentId: string, field: 'cost_center' | 'billing_email'): string {
  const loc = detail?.locations?.find(l => String(l.id) === locationId)
  const dept = loc?.departments?.find(d => String(d.id) === departmentId)
  return dept?.[field] || loc?.[field] || detail?.[field] || ''
}

// Today as an input[type=date] value (YYYY-MM-DD) — the start-date PROPOSAL
// (job 19); the recruiter can still change it, it's just a sensible default.
function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A labelled field wrapper — optional `error` shows the shared required-field
// message (422 field mapping below sets these booleans).
function F({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  const { t } = useTranslation('common')
  return <div><div style={lbl}>{label}</div>{children}{error && <div style={errMsg}>{t('required')}</div>}</div>
}

export default function MatchPlacementModal({ candidateId: fixedCandidateId, onClose, onCreated }: {
  // Fixed when opened from a candidate's Match tab; absent on the Matches page —
  // then a candidate picker appears at the top of RELATIES (Danny 2026-07-13).
  candidateId?: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const customerOptions = useCustomerOptions(true)
  const vacancyOptions = useVacancyOptions(true)
  // Candidate picker (only when no fixed candidate): light option list from the API.
  const [pickedCandidateId, setPickedCandidateId] = useState('')
  const [candidateOptions, setCandidateOptions] = useState<Array<{ id?: Id; name?: string }>>([])
  useEffect(() => {
    if (fixedCandidateId) return
    api.get('/candidates', { params: { per_page: 200 } })
      .then(r => setCandidateOptions((r.data?.data ?? []) as Array<{ id?: Id; name?: string }>))
      .catch(() => setCandidateOptions([]))
  }, [fixedCandidateId])
  const candidateId = fixedCandidateId ?? (pickedCandidateId || '')
  const { functions } = useFunctions()
  const { types: contractTypes } = useContractTypes()

  // AXIS-MATRIX-2 preflight (item 22, pattern-prover): POST /matches enforces
  // match.create against the candidate server-side (MatchController::store) —
  // surface the same warn/block decision here BEFORE submit, not just after a
  // rejected POST. Minimal: an inline banner only, no button-gating yet (the full
  // P-dialog rollout is a later wave).
  const { decision: matchRuleDecision } = useActionRulePreflight('match.create', { candidateId: String(candidateId || '') })

  // ── Relaties ── customer drives the location/department/contact cascade.
  const [customerId, setCustomerId] = useState('')
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [contactId, setContactId] = useState('')
  // Inline contact-create (Danny): when a customer has no matching contact, add one
  // and couple it to the picked location right here (POST /customers/{id}/contacts).
  const [creatingContact, setCreatingContact] = useState(false)
  const [nc, setNc] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [func, setFunc] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [ownerId, setOwnerId] = useState('')

  // ── Contract ──
  const [contractType, setContractType] = useState('')
  // Proposal, not a hard default — the recruiter can freely change it (job 19).
  const [startDate, setStartDate] = useState(todayISO)
  const [endDate, setEndDate] = useState('')
  const [hours, setHours] = useState('')
  const [cao, setCao] = useState('')

  // ── Financieel ──
  const [scale, setScale] = useState('')
  const [step, setStep] = useState('')
  const [purchase, setPurchase] = useState('')
  const [sell, setSell] = useState('')
  // Cost centre + billing email are takeover-default PROPOSALS from the customer/
  // location/department cascade (job 21/22) — the *Dirty flags freeze them the
  // moment the recruiter types their own value, so a later customer/location/
  // department pick never clobbers a manual edit.
  const [costCenter, setCostCenter] = useState('')
  const [costCenterDirty, setCostCenterDirty] = useState(false)
  const [billingEmails, setBillingEmails] = useState<string[]>([''])
  const [billingDirty, setBillingDirty] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [remarksExpanded, setRemarksExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  // 422 field errors (house pattern, mirrors AddCandidateModal/AddCustomerModal) +
  // a non-field fallback banner — replaces the old generic-toast-only handling.
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  // Rate proposal (MATCH-PLACEMENT-2): debounced lookup keyed on customer + function
  // (+ optional cao/scale/step). Prefills empty rate fields + drives the deviation
  // guard below; the hook owns all of that logic (kept out of this file, §0.3).
  const { proposal, deviatesFromProposal, confirmDeviation, setConfirmDeviation } =
    useRateProposal({ customerId, functionTitle: func, cao, scale, step, purchase, sell, setPurchase, setSell })

  // Vestiging-mismatch (fase 3): the candidate's own branch vs the customer's.
  // 'placement' = only this placement keeps the customer's branch (default);
  // 'candidate' = also move the candidate's branch to the customer's.
  const [candBranch, setCandBranch] = useState<{ id: Id | null; name: string } | null>(null)
  const [mismatchChoice, setMismatchChoice] = useState<'placement' | 'candidate'>('placement')

  // Load the candidate's branch once — needed for the mismatch check.
  useEffect(() => {
    if (!candidateId) { setCandBranch(null); return }
    let alive = true
    api.get(`/candidates/${candidateId}`)
      .then(r => {
        if (!alive) return
        const d = (unwrap(r)) as { branch_id?: Id | null; location?: { name?: string } | null }
        setCandBranch({ id: d?.branch_id ?? null, name: d?.location?.name ?? '' })
      })
      .catch(() => { if (alive) setCandBranch(null) })
    return () => { alive = false }
  }, [candidateId])

  // Fetch the customer's locations/contacts/departments when a customer is picked
  // — the cascade cost-centre/billing-email PROPOSAL is owned by the two effects
  // below (kept separate: this effect only loads data, §0.3 single purpose).
  useEffect(() => {
    if (!customerId) { setDetail(null); return }
    let alive = true
    setLocationId(''); setDepartmentId(''); setContactId('')
    api.get(`/customers/${customerId}`)
      .then(r => { if (alive) setDetail((unwrap(r)) as CustomerDetail) })
      .catch(() => { if (alive) setDetail(null) })
    return () => { alive = false }
  }, [customerId])

  // Cost-centre PROPOSAL — recomputed live from the deepest picked level that
  // carries a value; frozen the instant the recruiter edits the field by hand.
  useEffect(() => {
    if (costCenterDirty) return
    setCostCenter(cascadeValue(detail, locationId, departmentId, 'cost_center'))
  }, [detail, locationId, departmentId, costCenterDirty])

  // Same proposal pattern for the PRIMARY billing email (slot 0) — extra rows
  // (1+) are the recruiter's own additions and are never touched by the cascade.
  useEffect(() => {
    if (billingDirty) return
    setBillingEmails([cascadeValue(detail, locationId, departmentId, 'billing_email')])
  }, [detail, locationId, departmentId, billingDirty])

  // Mismatch only counts when BOTH sides actually carry a branch (§3B: nullable).
  const branchMismatch = Boolean(candBranch?.id && detail?.branch_id && String(candBranch.id) !== String(detail.branch_id))

  const locations   = detail?.locations ?? []
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []
  const contacts    = detail?.contacts ?? []

  // Margin = sell − purchase, shown live (never entered).
  const margin = (Number(sell) || 0) - (Number(purchase) || 0)
  const hasRates = purchase !== '' && sell !== ''

  // POST the placement. vacancy_id + department are optional; the rest form the
  // contract layer (persisted once BE adds the columns — currently tolerated).
  const submit = async () => {
    if (!candidateId || !customerId || !func) return
    setSaving(true)
    setErrors({}); setSubmitErr(null)
    const body: Record<string, unknown> = {
      candidate_id: candidateId,
      customer_id: customerId,
      customer_location_id: locationId || null,
      customer_department_id: departmentId || null,
      contact_id: contactId || null,
      function_title: func,
      contract_type: contractType || null,
      start_date: startDate || null,
      end_date: endDate || null,
      hours_per_week: hours ? Number(hours) : null,
      cao: cao || null,
      scale: scale || null,
      step: step || null,
      purchase_rate: purchase ? Number(purchase) : null,
      sell_rate: sell ? Number(sell) : null,
      cost_center: costCenter || null,
      billing_emails: billingEmails.map(e => e.trim()).filter(Boolean),
      remarks: remarks || null,
      ...(vacancyId ? { vacancy_id: vacancyId } : {}),
      ...(ownerId ? { owner_id: ownerId } : {}),
    }
    try {
      await api.post('/matches', body)
      // Mismatch resolution: recruiter chose to move the candidate's branch along.
      // Best-effort AFTER the placement (its failure must not lose the match).
      if (branchMismatch && mismatchChoice === 'candidate' && detail?.branch_id) {
        await api.patch(`/candidates/${candidateId}`, { location_id: detail.branch_id }).catch(() => {})
      }
      notifySuccess(t('placement.created'))
      onCreated(); onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one) so the user isn't left guessing.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setSubmitErr(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    } finally { setSaving(false) }
  }

  // First click on a deviating submit shows the inline confirm instead of posting;
  // the second click (confirm already true) goes through — "one extra click", no hard block.
  const handleSubmitClick = () => {
    if (deviatesFromProposal && !confirmDeviation) { setConfirmDeviation(true); return }
    submit()
  }

  const opt = (arr: Array<{ id?: Id; name?: string }>) => arr.map(x => ({ value: String(x.id), label: x.name ?? '—' }))

  // Create a contact for the current customer, coupled to the picked location, then
  // refetch the cascade and select the new contact.
  const saveContact = async () => {
    if (!customerId || !nc.first_name.trim() || !nc.last_name.trim()) return
    try {
      const r = await api.post(`/customers/${customerId}/contacts`, { ...nc, location_id: locationId || undefined })
      const created = (unwrap(r)) as { id?: Id }
      const fresh = await api.get(`/customers/${customerId}`)
      setDetail((unwrap(fresh)) as CustomerDetail)
      if (created?.id) setContactId(String(created.id))
      setCreatingContact(false); setNc({ first_name: '', last_name: '', email: '', phone: '' })
      notifySuccess(t('placement.contactCreated'))
    } catch {
      notifyError(t('placement.contactFailed'))
    }
  }

  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('placement.title')} tabIndex={-1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t('placement.title')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before the recruiter fills in the rest. */}
        {matchRuleDecision && matchRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 10 }}><ActionRuleBanner decision={matchRuleDecision} /></div>
        )}

        {/* ── Relaties ── */}
        <div style={sectionTitle}>{t('placement.relations')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Candidate picker — only when the modal wasn't opened from a candidate.
              Searchable (job 18): the candidate list can run into the hundreds. */}
          {!fixedCandidateId && (
            <F label={t('placement.candidate')} error={errors.pickedCandidateId}>
              <CreatableSelect value={pickedCandidateId || null} onChange={setPickedCandidateId} allowCreate={false}
                placeholder={t('placement.pickCandidate')} menuWidth={pickerMenuWidth}
                options={candidateOptions.map(c => ({ value: String(c.id), label: c.name ?? '—' }))} />
            </F>
          )}
          <div style={row2}>
            {/* Klant/locatie — typeable searchable pickers (job 17/18), never free-text
                create (allowCreate={false}: a customer/location is a real relational id). */}
            <F label={t('placement.customer')} error={errors.customerId}>
              <CreatableSelect value={customerId || null} onChange={setCustomerId} allowCreate={false}
                placeholder={t('placement.pickCustomer')} menuWidth={pickerMenuWidth}
                options={customerOptions.map(c => ({ value: String(c.value), label: c.label }))} />
            </F>
            <F label={t('placement.location')} error={errors.locationId}>
              <CreatableSelect value={locationId || null} onChange={v => { setLocationId(v); setDepartmentId('') }}
                allowCreate={false} menuWidth={pickerMenuWidth}
                placeholder={customerId ? t('placement.pickLocation') : t('placement.pickCustomerFirst')}
                options={opt(locations)} />
            </F>
          </div>
          <div style={row2}>
            {/* Afdeling/contactpersoon — same searchable pattern. */}
            <F label={t('placement.department')} error={errors.departmentId}>
              <CreatableSelect value={departmentId || null} onChange={setDepartmentId} allowCreate={false}
                placeholder={t('placement.optional')} menuWidth={pickerMenuWidth} options={opt(departments)} />
            </F>
            <div>
              <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('placement.contact')}</span>
                {customerId && !creatingContact && (
                  <button onClick={() => setCreatingContact(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 11, fontWeight: 600, padding: 0 }}>+ {t('placement.newContact')}</button>
                )}
              </div>
              {creatingContact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input value={nc.first_name} onChange={e => setNc(p => ({ ...p, first_name: e.target.value }))} placeholder={t('placement.firstName')} style={{ ...input, height: 30 }} />
                    <input value={nc.last_name} onChange={e => setNc(p => ({ ...p, last_name: e.target.value }))} placeholder={t('placement.lastName')} style={{ ...input, height: 30 }} />
                  </div>
                  <input value={nc.email} onChange={e => setNc(p => ({ ...p, email: e.target.value }))} placeholder={t('placement.email')} style={{ ...input, height: 30 }} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setCreatingContact(false); setNc({ first_name: '', last_name: '', email: '', phone: '' }) }} style={{ height: 28, padding: '0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
                    <button onClick={saveContact} disabled={!nc.first_name.trim() || !nc.last_name.trim()} style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', opacity: (nc.first_name.trim() && nc.last_name.trim()) ? 1 : 0.4 }}>{t('common:save')}</button>
                  </div>
                </div>
              ) : (
                <CreatableSelect value={contactId || null} onChange={setContactId} allowCreate={false} menuWidth={pickerMenuWidth}
                  placeholder={customerId ? t('placement.pickContact') : t('placement.pickCustomerFirst')} options={opt(contacts)} />
              )}
              {errors.contactId && <div style={errMsg}>{t('common:required')}</div>}
            </div>
          </div>
          <div style={row2}>
            {/* Functie — searchable (tenant lookup, can run to dozens of job titles);
                Recruiter stays a plain SelectMenu (small, not in job 18's long-list scope). */}
            <F label={t('placement.function')} error={errors.func}>
              <CreatableSelect value={func || null} onChange={setFunc} allowCreate={false}
                placeholder={t('placement.pickFunction')} menuWidth={pickerMenuWidth}
                options={functions.map(f => ({ value: f, label: f }))} />
            </F>
            <F label={t('placement.owner')} error={errors.ownerId}>
              <SelectMenu value={ownerId || null} onChange={setOwnerId} placeholder={t('placement.optional')}
                options={users.map(u => ({ value: String(u.id), label: u.name ?? '—' }))} />
            </F>
          </div>
          {/* Vacature — searchable, mirrors PlanIntakeModal's vacancy picker. */}
          <F label={t('placement.vacancyOptional')} error={errors.vacancyId}>
            <CreatableSelect value={vacancyId || null} onChange={setVacancyId} allowCreate={false}
              placeholder={t('placement.noVacancy')} menuWidth={340}
              options={vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))} />
          </F>

          {/* Vestiging-mismatch (fase 3): candidate branch ≠ customer branch → calm
              inline choice. Default: only this placement; opt-in: move the candidate. */}
          {branchMismatch && (
            <div role="group" aria-label={t('placement.branchMismatch')}
              style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '9px 11px', borderRadius: 8, fontSize: 12,
                color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
              <span style={{ fontWeight: 600 }}>
                {t('placement.branchMismatchDesc', { candidate: candBranch?.name || '—', customer: detail?.branch?.name || '—' })}
              </span>
              {(['placement', 'candidate'] as const).map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--text)' }}>
                  <input type="radio" name="branch-mismatch" checked={mismatchChoice === v} onChange={() => setMismatchChoice(v)} />
                  {t(v === 'placement' ? 'placement.branchKeep' : 'placement.branchMove')}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Contract ── */}
        <div style={sectionTitle}>{t('placement.contract')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={row2}>
            <F label={t('placement.contractType')} error={errors.contractType}>
              <SelectMenu value={contractType || null} onChange={setContractType} placeholder={t('placement.pickContractType')}
                options={contractTypes.map(c => ({ value: c, label: c }))} />
            </F>
            <F label={t('placement.cao')} error={errors.cao}><input value={cao} onChange={e => setCao(e.target.value)} style={input} placeholder="VVT" /></F>
          </div>
          <div style={row2}>
            <F label={t('placement.startDate')} error={errors.startDate}><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={input} /></F>
            <F label={t('placement.endDate')} error={errors.endDate}><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={input} /></F>
          </div>
          <F label={t('placement.hoursPerWeek')} error={errors.hours}><input type="number" min={1} max={40} value={hours} onChange={e => setHours(e.target.value)} style={{ ...input, width: 120 }} /></F>
        </div>

        {/* ── Financieel ── */}
        <div style={sectionTitle}>{t('placement.financial')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={row2}>
            <F label={t('placement.scale')} error={errors.scale}><input value={scale} onChange={e => setScale(e.target.value)} style={input} /></F>
            <F label={t('placement.step')} error={errors.step}><input value={step} onChange={e => setStep(e.target.value)} style={input} /></F>
          </div>
          <div style={row2}>
            <F label={t('placement.purchaseRate')} error={errors.purchase}><input type="number" step="0.01" value={purchase} onChange={e => setPurchase(e.target.value)} style={input} placeholder="22,18" /></F>
            <F label={t('placement.sellRate')} error={errors.sell}><input type="number" step="0.01" value={sell} onChange={e => setSell(e.target.value)} style={input} placeholder="62,10" /></F>
          </div>
          {/* Rate proposal hint — only fills EMPTY fields above (never overwrites input). */}
          <RateProposalHint proposal={proposal} />
          {/* Margin shown live — derived, never entered. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 12px', borderRadius: 8,
            background: 'var(--surface-2, var(--bg))', border: '1px solid var(--border)',
            color: hasRates ? (margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('placement.margin')}</span>
            <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{hasRates ? margin.toFixed(2) : '—'}</span>
          </div>
          <div style={row2}>
            {/* Cost centre — proposed from the customer/location cascade above; typing
                here freezes it (job 21/22 — never overwritten again after that). */}
            <F label={t('placement.costCenter')} error={errors.costCenter}>
              <input value={costCenter} onChange={e => { setCostCenterDirty(true); setCostCenter(e.target.value) }}
                style={input} placeholder="KP-…" />
            </F>
            <F label={t('placement.billingEmail')} error={errors.billingEmails}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {billingEmails.map((em, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="email" value={em} placeholder={i === 0 ? t('placement.billingEmailMain') : t('placement.billingEmailExtra')}
                      onChange={e => { setBillingDirty(true); setBillingEmails(p => p.map((x, j) => j === i ? e.target.value : x)) }} style={input} />
                    {billingEmails.length > 1 && (
                      <button onClick={() => { setBillingDirty(true); setBillingEmails(p => p.filter((_, j) => j !== i)) }} aria-label={t('common:close')}
                        style={{ flexShrink: 0, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={13} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => { setBillingDirty(true); setBillingEmails(p => [...p, '']) }}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, padding: 0 }}>+ {t('placement.addBillingEmail')}</button>
              </div>
            </F>
          </div>
          {/* Opmerkingen — the shared rich-text block (house rule, CLAUDE.md §3A/§4),
              not a bare textarea; stored/POSTed as sanitised HTML. */}
          <F label={t('placement.remarks')} error={errors.remarks}>
            <RichTextEditor value={remarks} onChange={setRemarks}
              expanded={remarksExpanded} onToggleExpand={() => setRemarksExpanded(v => !v)} />
          </F>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {submitErr && (
          <div role="alert" style={{ marginTop: 12, padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {submitErr}
          </div>
        )}

        {/* Deviation guard (Danny's "weet je het zeker?"): the entered rates differ from a
            FOUND agreement proposal — calm inline confirm, one extra click, no hard block. */}
        {deviatesFromProposal && confirmDeviation && (
          <RateDeviationWarning proposal={proposal} purchase={purchase} sell={sell} onCancel={() => setConfirmDeviation(false)} />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={handleSubmitClick} disabled={saving || !customerId || !func}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: (customerId && func) ? 'pointer' : 'default', opacity: (customerId && func) ? 1 : 0.4 }}>
            {saving ? t('common:saving') : (deviatesFromProposal && confirmDeviation ? t('placement.rateProposal.deviationConfirm') : t('placement.create'))}
          </button>
        </div>
      </div>
    </>
  )
}
