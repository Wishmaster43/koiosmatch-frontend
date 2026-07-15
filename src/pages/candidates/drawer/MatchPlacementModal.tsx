/**
 * MatchPlacementModal — the full "+ Match" / placement form on the candidate Match
 * tab (MATCH-PLACEMENT-1, fase 1). A placement IS the Match (one record), so this
 * POSTs to /matches with the contract/financial layer. The customer→location→
 * department→contact cascade, function + contract-type dropdowns, dates/hours and
 * the purchase/sell/margin block all work now; /matches tolerates the extra fields
 * (ignored until the backend model lands, then persisted). Rates propose from a
 * price agreement / conversion factor once customer + function are picked
 * (MATCH-PLACEMENT-2, useRateProposal) — the margin is shown live.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import SelectMenu from '@/components/ui/SelectMenu'
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
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '18px 0 10px' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

interface UserLike { id?: Id; name?: string }
// Fase-3 fields: branch (vestiging) + cost-centre/billing takeover defaults per
// customer and per location — the location default wins once a location is picked.
interface CustomerDetail {
  branch_id?: Id | null
  branch?: { id?: Id; name?: string } | null
  cost_center?: string | null
  billing_email?: string | null
  locations?: Array<{ id?: Id; name?: string; cost_center?: string | null; billing_email?: string | null; departments?: Array<{ id?: Id; name?: string }> }>
  contacts?: Array<{ id?: Id; name?: string }>
}

// A labelled field wrapper.
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={lbl}>{label}</div>{children}</div>
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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hours, setHours] = useState('')
  const [cao, setCao] = useState('')

  // ── Financieel ──
  const [scale, setScale] = useState('')
  const [step, setStep] = useState('')
  const [purchase, setPurchase] = useState('')
  const [sell, setSell] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [billingEmails, setBillingEmails] = useState<string[]>([''])
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

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

  // Fetch the customer's locations/contacts when a customer is picked (cascade),
  // and prefill the takeover defaults (cost centre + billing email) from the
  // customer — only into still-empty fields, never over the recruiter's input.
  useEffect(() => {
    if (!customerId) { setDetail(null); return }
    let alive = true
    setLocationId(''); setDepartmentId(''); setContactId('')
    api.get(`/customers/${customerId}`)
      .then(r => {
        if (!alive) return
        const d = (unwrap(r)) as CustomerDetail
        setDetail(d)
        if (d?.cost_center) setCostCenter(prev => prev || d.cost_center!)
        if (d?.billing_email) setBillingEmails(prev => (prev.length === 1 && !prev[0].trim()) ? [d.billing_email!] : prev)
      })
      .catch(() => { if (alive) setDetail(null) })
    return () => { alive = false }
  }, [customerId])

  // Location default wins over the customer default once a location is picked.
  useEffect(() => {
    if (!locationId || !detail) return
    const loc = (detail.locations ?? []).find(l => String(l.id) === locationId)
    if (loc?.cost_center) setCostCenter(loc.cost_center)
    if (loc?.billing_email) setBillingEmails(prev => (prev.length === 1 && !prev[0].trim()) ? [loc.billing_email!] : prev)
  }, [locationId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch {
      notifyError(t('placement.failed'))
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
          {/* Candidate picker — only when the modal wasn't opened from a candidate. */}
          {!fixedCandidateId && (
            <F label={t('placement.candidate')}>
              <SelectMenu value={pickedCandidateId || null} onChange={setPickedCandidateId}
                placeholder={t('placement.pickCandidate')}
                options={candidateOptions.map(c => ({ value: String(c.id), label: c.name ?? '—' }))} />
            </F>
          )}
          <div style={row2}>
            <F label={t('placement.customer')}>
              <SelectMenu value={customerId || null} onChange={setCustomerId} placeholder={t('placement.pickCustomer')}
                options={customerOptions.map(c => ({ value: String(c.value), label: c.label }))} />
            </F>
            <F label={t('placement.location')}>
              <SelectMenu value={locationId || null} onChange={v => { setLocationId(v); setDepartmentId('') }}
                placeholder={customerId ? t('placement.pickLocation') : t('placement.pickCustomerFirst')}
                options={opt(locations)} />
            </F>
          </div>
          <div style={row2}>
            <F label={t('placement.department')}>
              <SelectMenu value={departmentId || null} onChange={setDepartmentId} placeholder={t('placement.optional')} options={opt(departments)} />
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
                <SelectMenu value={contactId || null} onChange={setContactId} placeholder={customerId ? t('placement.pickContact') : t('placement.pickCustomerFirst')} options={opt(contacts)} />
              )}
            </div>
          </div>
          <div style={row2}>
            <F label={t('placement.function')}>
              <SelectMenu value={func || null} onChange={setFunc} placeholder={t('placement.pickFunction')}
                options={functions.map(f => ({ value: f, label: f }))} />
            </F>
            <F label={t('placement.owner')}>
              <SelectMenu value={ownerId || null} onChange={setOwnerId} placeholder={t('placement.optional')}
                options={users.map(u => ({ value: String(u.id), label: u.name ?? '—' }))} />
            </F>
          </div>
          <F label={t('placement.vacancyOptional')}>
            <SelectMenu value={vacancyId || null} onChange={setVacancyId} placeholder={t('placement.noVacancy')}
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
            <F label={t('placement.contractType')}>
              <SelectMenu value={contractType || null} onChange={setContractType} placeholder={t('placement.pickContractType')}
                options={contractTypes.map(c => ({ value: c, label: c }))} />
            </F>
            <F label={t('placement.cao')}><input value={cao} onChange={e => setCao(e.target.value)} style={input} placeholder="VVT" /></F>
          </div>
          <div style={row2}>
            <F label={t('placement.startDate')}><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={input} /></F>
            <F label={t('placement.endDate')}><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={input} /></F>
          </div>
          <F label={t('placement.hoursPerWeek')}><input type="number" min={1} max={40} value={hours} onChange={e => setHours(e.target.value)} style={{ ...input, width: 120 }} /></F>
        </div>

        {/* ── Financieel ── */}
        <div style={sectionTitle}>{t('placement.financial')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={row2}>
            <F label={t('placement.scale')}><input value={scale} onChange={e => setScale(e.target.value)} style={input} /></F>
            <F label={t('placement.step')}><input value={step} onChange={e => setStep(e.target.value)} style={input} /></F>
          </div>
          <div style={row2}>
            <F label={t('placement.purchaseRate')}><input type="number" step="0.01" value={purchase} onChange={e => setPurchase(e.target.value)} style={input} placeholder="22,18" /></F>
            <F label={t('placement.sellRate')}><input type="number" step="0.01" value={sell} onChange={e => setSell(e.target.value)} style={input} placeholder="62,10" /></F>
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
            <F label={t('placement.costCenter')}><input value={costCenter} onChange={e => setCostCenter(e.target.value)} style={input} placeholder="KP-…" /></F>
            <F label={t('placement.billingEmail')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {billingEmails.map((em, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="email" value={em} placeholder={i === 0 ? t('placement.billingEmailMain') : t('placement.billingEmailExtra')}
                      onChange={e => setBillingEmails(p => p.map((x, j) => j === i ? e.target.value : x))} style={input} />
                    {billingEmails.length > 1 && (
                      <button onClick={() => setBillingEmails(p => p.filter((_, j) => j !== i))} aria-label={t('common:close')}
                        style={{ flexShrink: 0, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={13} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setBillingEmails(p => [...p, ''])}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, padding: 0 }}>+ {t('placement.addBillingEmail')}</button>
              </div>
            </F>
          </div>
          <F label={t('placement.remarks')}>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
              style={{ ...input, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
          </F>
        </div>

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
