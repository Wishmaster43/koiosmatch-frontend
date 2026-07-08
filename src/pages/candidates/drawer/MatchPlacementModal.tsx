/**
 * MatchPlacementModal — the full "+ Match" / placement form on the candidate Match
 * tab (MATCH-PLACEMENT-1, fase 1). A placement IS the Match (one record), so this
 * POSTs to /matches with the contract/financial layer. The customer→location→
 * department→contact cascade, function + contract-type dropdowns, dates/hours and
 * the purchase/sell/margin block all work now; /matches tolerates the extra fields
 * (ignored until the backend model lands, then persisted). Rates propose nothing
 * yet (CAO/price-agreement is fase 2) — the margin is shown live.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import SelectMenu from '@/components/ui/SelectMenu'
import { useUsers } from '@/lib/queries'
import { useCustomerOptions } from '@/pages/vacancies/hooks/useCustomerOptions'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import { useFunctions } from '@/lib/useFunctions'
import { useContractTypes } from '@/lib/useContractTypes'
import type { Id } from '@/types/common'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '18px 0 10px' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

interface UserLike { id?: Id; name?: string }
interface CustomerDetail { locations?: Array<{ id?: Id; name?: string; departments?: Array<{ id?: Id; name?: string }> }>; contacts?: Array<{ id?: Id; name?: string }> }

// A labelled field wrapper.
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={lbl}>{label}</div>{children}</div>
}

export default function MatchPlacementModal({ candidateId, onClose, onCreated }: {
  candidateId: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const customerOptions = useCustomerOptions(true)
  const vacancyOptions = useVacancyOptions(true)
  const { functions } = useFunctions()
  const { types: contractTypes } = useContractTypes()

  // ── Relaties ── customer drives the location/department/contact cascade.
  const [customerId, setCustomerId] = useState('')
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [contactId, setContactId] = useState('')
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
  const [billingEmail, setBillingEmail] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch the customer's locations/contacts when a customer is picked (cascade).
  useEffect(() => {
    if (!customerId) { setDetail(null); return }
    let alive = true
    setLocationId(''); setDepartmentId(''); setContactId('')
    api.get(`/customers/${customerId}`)
      .then(r => { if (alive) setDetail((r.data?.data ?? r.data) as CustomerDetail) })
      .catch(() => { if (alive) setDetail(null) })
    return () => { alive = false }
  }, [customerId])

  const locations   = detail?.locations ?? []
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []
  const contacts    = detail?.contacts ?? []

  // Margin = sell − purchase, shown live (never entered).
  const margin = (Number(sell) || 0) - (Number(purchase) || 0)
  const hasRates = purchase !== '' && sell !== ''

  // POST the placement. vacancy_id + department are optional; the rest form the
  // contract layer (persisted once BE adds the columns — currently tolerated).
  const submit = async () => {
    if (!customerId || !func) return
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
      billing_email: billingEmail || null,
      remarks: remarks || null,
      ...(vacancyId ? { vacancy_id: vacancyId } : {}),
      ...(ownerId ? { owner_id: ownerId } : {}),
    }
    try {
      await api.post('/matches', body)
      notifySuccess(t('placement.created'))
      onCreated(); onClose()
    } catch {
      notifyError(t('placement.failed'))
    } finally { setSaving(false) }
  }

  const opt = (arr: Array<{ id?: Id; name?: string }>) => arr.map(x => ({ value: String(x.id), label: x.name ?? '—' }))

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div style={panel} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t('placement.title')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* ── Relaties ── */}
        <div style={sectionTitle}>{t('placement.relations')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <F label={t('placement.contact')}>
              <SelectMenu value={contactId || null} onChange={setContactId} placeholder={customerId ? t('placement.pickContact') : t('placement.pickCustomerFirst')} options={opt(contacts)} />
            </F>
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
          {/* Margin shown live — derived, never entered. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 12px', borderRadius: 8,
            background: 'var(--surface-2, var(--bg))', border: '1px solid var(--border)',
            color: hasRates ? (margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('placement.margin')}</span>
            <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{hasRates ? margin.toFixed(2) : '—'}</span>
          </div>
          <div style={row2}>
            <F label={t('placement.costCenter')}><input value={costCenter} onChange={e => setCostCenter(e.target.value)} style={input} placeholder="KP-…" /></F>
            <F label={t('placement.billingEmail')}><input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} style={input} /></F>
          </div>
          <F label={t('placement.remarks')}>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
              style={{ ...input, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
          </F>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={submit} disabled={saving || !customerId || !func}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: (customerId && func) ? 'pointer' : 'default', opacity: (customerId && func) ? 1 : 0.4 }}>
            {saving ? t('common:saving') : t('placement.create')}
          </button>
        </div>
      </div>
    </>
  )
}
