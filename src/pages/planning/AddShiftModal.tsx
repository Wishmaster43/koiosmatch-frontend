/**
 * AddShiftModal — the "plan a shift" dialog: order/location/colour, shift times,
 * candidate search and notes. Self-contained subtree (its Field/SectionHead/
 * Avatar/CandidateRow helpers + style consts live here). Extracted from
 * PlanningPage. PLAN-LOOKUP-1 (2026-07-16): the customer/department/job-title
 * selects and the candidate list used to be hardcoded Dutch demo data — see
 * ./hooks/useShiftLookups for the real sources and why the old fake
 * favourite/distance suggestion ranking was dropped instead of re-faked.
 */
import { useState, useId, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ReactNode, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, Search } from 'lucide-react'
import { formatDate } from './helpers'
import { interactive } from '@/lib/a11y'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useFunctions } from '@/lib/useFunctions'
import { useShiftCustomers, useShiftDepartments, useShiftCandidateSearch } from './hooks/useShiftLookups'
import type { ShiftCandidateOption } from './hooks/useShiftLookups'
import { BTN_H } from '@/config/buttonMetrics'
import type { ShiftInput } from '@/types/planning'

// ── Field helpers ─────────────────────────────────────────────────────────────
const INPUT: CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7,
  outline: 'none', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const LABEL: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const SELECT: CSSProperties = { ...INPUT, appearance: 'none', cursor: 'pointer' }

function Field({ label, children }: { label?: ReactNode; children: ReactNode }) {
  // Associate the label with its single input via a generated id (§6).
  const id = useId()
  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children
  return <div style={{ marginBottom: 10 }}><label htmlFor={id} style={LABEL}>{label}</label>{child}</div>
}

function SectionHead({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
      textTransform: 'uppercase', padding: '8px 0 4px', borderBottom: '1px solid var(--border)', marginBottom: 10, ...style }}>
      {children}
    </div>
  )
}

// One fixed palette, picked deterministically from a name's initials — no
// per-candidate "colour" field exists (or should — see the hook file header
// for why favourite/ranking data isn't faked), this replaces that need for
// both the avatar and the scheduled-candidate accent border.
// eslint-disable-next-line no-restricted-syntax -- DATA: avatar colour-cycling palette, not UI element styling
const AVATAR_COLORS = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', '#8B5CF6', '#EC4899']
function colorFor(initials: string) {
  return AVATAR_COLORS[initials.charCodeAt(0) % AVATAR_COLORS.length]
}

// "Jan de Boer" → "JD" (max 2 letters); falls back to "?" for an empty name.
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const chars = [parts[0]?.[0], parts[1]?.[0]].filter(Boolean).join('')
  return (chars || '?').toUpperCase()
}

function Avatar({ initials, size = 26 }: { initials: string; size?: number }) {
  const color = colorFor(initials)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontSize: size * 0.36, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

// ── Add Shift Modal ───────────────────────────────────────────────────────────
export default function AddShiftModal({ date, onClose, onAdd }: { date: Date; onClose: () => void; onAdd: (shift: ShiftInput) => void }) {
  const { t } = useTranslation('planning')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const [title,       setTitle]       = useState('')
  const [start,       setStart]       = useState('07:00')
  const [end,         setEnd]         = useState('15:00')
  const [jobType,     setJobType]     = useState('')
  const [customerId,  setCustomerId]  = useState('')
  const [departmentId,setDepartmentId]= useState('')
  const [address,     setAddress]     = useState('')
  const [personCount, setPersonCount] = useState(1)
  const [candidate,   setCandidate]   = useState<ShiftCandidateOption | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [color,       setColor]       = useState('var(--color-success)')
  // eslint-disable-next-line no-restricted-syntax -- DATA: shift-colour picker palette, not UI element styling
  const COLORS = ['var(--color-success)','var(--color-primary)','var(--color-warning)','var(--color-danger)','var(--color-secondary)','#8B5CF6']

  // Real lookups (PLAN-LOOKUP-1) — see ./hooks/useShiftLookups for sourcing.
  const { customers, loading: customersLoading, error: customersError } = useShiftCustomers()
  const { departments, loading: departmentsLoading, error: departmentsError } = useShiftDepartments(customerId)
  const { functions } = useFunctions()
  const { candidates, loading: candidatesLoading, error: candidatesError } = useShiftCandidateSearch(searchQuery)

  const customerName = customers.find(c => String(c.id) === customerId)?.name ?? ''

  // A new customer invalidates the previously picked department (it belonged to
  // the old customer) — mirrors AddOpportunityModal's cascade reset.
  const handleCustomerChange = (id: string) => { setCustomerId(id); setDepartmentId('') }

  const handleSave = () => {
    onAdd({ title, location: customerName, candidate: candidate?.name || '', start, end, color, date })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}
        onClick={e => e.target === e.currentTarget && onClose()}>

        {/* ── Modal wrapper gecentreerd ── */}
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('addShift')} tabIndex={-1}
          style={{ margin: 'auto', width: '92%', maxWidth: 1100, height: '90vh',
          background: 'var(--bg)', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)' }}>

          {/* Header balk */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px',
            background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sidebar-text)' }}>{t('addShift')}</span>
              <span style={{ fontSize: 12, color: 'var(--sidebar-muted)', marginLeft: 10 }}>{formatDate(date)}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
              <button onClick={handleSave}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 16px', fontSize: 12,
                  fontWeight: 600, background: 'var(--color-primary)', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                <Save size={13} /> {t('common:save')}
              </button>
              <button onClick={onClose} aria-label={t('common:close')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, background: 'none', border: '1px solid var(--sidebar-border)',
                  borderRadius: 8, cursor: 'pointer', color: 'var(--sidebar-muted)' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Body: 3 kolommen */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* ── Links: order info ── */}
            <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
              background: 'var(--surface)', overflowY: 'auto', padding: '14px 14px' }}>
              <SectionHead>{t('sectionOrder')}</SectionHead>
              <Field label={t('fCustomer')}>
                <select style={SELECT} value={customerId} disabled={customersLoading}
                  onChange={e => handleCustomerChange(e.target.value)}>
                  <option value="">
                    {customersLoading ? t('common:loading')
                      : customersError ? t('common:errorGeneric')
                      : customers.length === 0 ? t('common:noResults')
                      : t('common:select')}
                  </option>
                  {customers.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              </Field>
              <Field label={t('fDepartment')}>
                <select style={SELECT} value={departmentId} disabled={!customerId || departmentsLoading}
                  onChange={e => setDepartmentId(e.target.value)}>
                  <option value="">
                    {!customerId ? t('pickCustomerFirst')
                      : departmentsLoading ? t('common:loading')
                      : departmentsError ? t('common:errorGeneric')
                      : departments.length === 0 ? t('common:noResults')
                      : t('common:select')}
                  </option>
                  {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </Field>
              <Field label={t('fAssignment')}><input style={INPUT} /></Field>
              <Field label={t('fContact')}><input style={INPUT} placeholder={t('contactPlaceholder')} /></Field>

              <SectionHead>{t('sectionLocation')}</SectionHead>
              <Field label={t('fAddress')}>
                <textarea style={{ ...INPUT, resize: 'none', height: 56 }}
                  value={address} onChange={e => setAddress(e.target.value)} />
              </Field>

              <SectionHead>{t('sectionColor')}</SectionHead>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>

            {/* ── Midden: dienst details ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              <SectionHead>{t('shift1')}</SectionHead>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <Field label={t('fShiftName')}>
                  <input style={INPUT} value={title} onChange={e => setTitle(e.target.value)} />
                </Field>
                <Field label={t('fStart')}>
                  <input type="time" style={INPUT} value={start} onChange={e => setStart(e.target.value)} />
                </Field>
                <Field label={t('fEnd')}>
                  <input type="time" style={INPUT} value={end} onChange={e => setEnd(e.target.value)} />
                </Field>
                <Field label={t('fPersons')}>
                  <input type="number" style={INPUT} value={personCount} min={1} max={20}
                    onChange={e => setPersonCount(Number(e.target.value))} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <Field label={t('fJobtype')}>
                  <select style={SELECT} value={jobType} onChange={e => setJobType(e.target.value)}>
                    <option value="">{t('common:select')}</option>
                    {functions.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label={t('fOpenShift')}>
                  <select style={SELECT}>
                    <option>{t('openAll')}</option>
                    <option>{t('openFavorites')}</option>
                    <option>{t('openFixed')}</option>
                  </select>
                </Field>
              </div>

              {/* Scheduled candidate */}
              <SectionHead>{t('scheduledWorker')}</SectionHead>
              {candidate ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  border: `1px solid ${colorFor(getInitials(candidate.name))}40`, borderLeft: `4px solid ${colorFor(getInitials(candidate.name))}`,
                  borderRadius: 8, background: 'var(--surface)', marginBottom: 10 }}>
                  <Avatar initials={getInitials(candidate.name)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{candidate.name}</div>
                    {candidate.functionTitle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{candidate.functionTitle}</div>}
                  </div>
                  <button onClick={() => setCandidate(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)',
                  borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {t('clickCandidate')}
                </div>
              )}

              {/* Notes */}
              <SectionHead>{t('notes')}</SectionHead>
              <textarea style={{ ...INPUT, height: 70, resize: 'none' }} placeholder={t('notePlaceholder')} aria-label={t('notePlaceholder')} />

              {/* Assignment performance */}
              <SectionHead style={{ marginTop: 16 }}>{t('performance')}</SectionHead>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {[t('colName'), t('colClient'), t('colFunction'), t('colColleagues')].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidate ? (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{candidate.name}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{customerName}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{candidate.functionTitle || '-'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>-</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        {t('noWorkerPlanned')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Rechts: kandidaat zoeken (PLAN-LOOKUP-1) ── */}
            <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)',
              background: 'var(--surface)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

              {/* Zoek */}
              <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('searchCandidate')} aria-label={t('searchCandidate')}
                    style={{ ...INPUT, paddingLeft: 28, fontSize: 12 }} />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
                  textTransform: 'uppercase', marginBottom: 6 }}>
                  {t('common:nav.candidates')}
                </div>

                {/* Four UI states — no fabricated favourite/distance ranking (see
                    ./hooks/useShiftLookups header): just what the search returns. */}
                {candidatesLoading && (
                  <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
                )}
                {!candidatesLoading && candidatesError && (
                  <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--color-danger)' }}>{t('common:errorGeneric')}</div>
                )}
                {!candidatesLoading && !candidatesError && candidates.length === 0 && (
                  <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:noResults')}</div>
                )}
                {!candidatesLoading && !candidatesError && candidates.map(c => (
                  <CandidateRow key={c.id} candidate={c} selected={candidate?.id === c.id} onClick={() => setCandidate(c)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CandidateRow({ candidate, selected, onClick }: { candidate: ShiftCandidateOption; selected?: boolean; onClick?: () => void }) {
  const initials = getInitials(candidate.name)
  return (
    <div {...interactive(onClick)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8,
        background: selected ? 'var(--color-primary-bg)' : 'transparent',
        border: selected ? `1px solid var(--color-primary)` : '1px solid transparent',
        cursor: 'pointer', marginBottom: 4, transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}>
      <Avatar initials={initials} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {candidate.name}
        </div>
        {candidate.functionTitle && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {candidate.functionTitle}
          </div>
        )}
      </div>
      {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
    </div>
  )
}
