/**
 * AddShiftModal — the "plan a shift" dialog: order/location/colour, shift times,
 * candidate search and notes. Self-contained subtree (its Field/Avatar/
 * CandidateRow helpers + style consts live here). Extracted from
 * PlanningPage. PLAN-LOOKUP-1 (2026-07-16): the customer/department/job-title
 * selects and the candidate list used to be hardcoded Dutch demo data — see
 * ./hooks/useShiftLookups for the real sources and why the old fake
 * favourite/distance suggestion ranking was dropped instead of re-faked.
 *
 * Widened to the house WIDE_MODAL constant and every SectionHead regrouped into
 * a titled bordered card (Danny 27-07: "+ dienst ook nalopen" — every create
 * modal must share +Match/+Kandidaat's footprint); customer/department/jobtype/
 * open-dienst are now searchable CreatableSelects, never a bare `<select>`. This
 * is a genuinely different screen from the single-form modals — a live
 * 3-column planner (order info / shift details / candidate search), not a form
 * — so the column widths and the 92vw responsive wrapper stay unchanged; only
 * the bespoke 1100/90vh frame numbers became the shared constant.
 */
import { useState, useId, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ReactNode, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, Search } from 'lucide-react'
import { formatDate } from './helpers'
import { interactive } from '@/lib/a11y'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useFunctions } from '@/lib/useFunctions'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useShiftCustomers, useShiftDepartments, useShiftCandidateSearch } from './hooks/useShiftLookups'
import type { ShiftCandidateOption } from './hooks/useShiftLookups'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import type { ShiftInput } from '@/types/planning'

// ── Field helpers — house footprint (padding '8px 11px', fontSize 13,
// borderRadius 8, §3A/§4) so this modal's inputs match every other create form,
// even though its 3-column workspace stays its own (genuinely different) layout. ──
const INPUT: CSSProperties = { padding: '8px 11px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  outline: 'none', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const LABEL: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }

function Field({ label, children }: { label?: ReactNode; children: ReactNode }) {
  // Associate the label with its single input via a generated id (§6).
  const id = useId()
  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children
  return <div style={{ marginBottom: 10 }}><label htmlFor={id} style={LABEL}>{label}</label>{child}</div>
}

// Card chrome (Danny 27-07: "+ dienst ook nalopen" — every create modal must match
// +Match/+Kandidaat's footprint) — 11px uppercase muted heading above a bordered
// surface (§3A), kept local (not a cross-import, CLAUDE.md §2). Replaces the old
// bare "uppercase label + border-bottom" SectionHead with the house card idiom;
// only the left/middle FORM columns get boxed — the right column is a live
// search/list widget, not a form section, so it keeps its own chrome (mirrors
// how RelationsSection's candidate/contact results aren't individually boxed).
const cardHead: CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }
const cardBox: CSSProperties = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, marginBottom: 14 }

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
  // "Open dienst" mode — was a fully decorative, unwired `<select>` before (no
  // value/onChange at all); now a controlled searchable picker for the same
  // three labels, still LOCAL UI state only (never part of the onAdd payload —
  // behaviour stays identical to what this modal submitted before).
  const [openShiftMode, setOpenShiftMode] = useState('all')
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

        {/* ── Modal wrapper gecentreerd — house WIDE_MODAL footprint (Danny 27-07:
            every create modal shares one frame). This panel genuinely has more to
            show than the single-form modals (a live 3-column planner, not a form),
            so it keeps its own 92vw responsive width; only the 1100/90vh numbers
            were bespoke and are now the shared constant (1060/94vh). ── */}
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('addShift')} tabIndex={-1}
          style={{ margin: 'auto', width: '92%', ...WIDE_MODAL,
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

            {/* ── Links: order info — each SectionHead became a titled bordered
                card (Danny 27-07); customer/department are searchable
                CreatableSelects, never a bare `<select>`. ── */}
            <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
              background: 'var(--surface)', overflowY: 'auto', padding: '14px 14px' }}>
              <div style={cardHead}>{t('sectionOrder')}</div>
              <div style={cardBox}>
                <Field label={t('fCustomer')}>
                  <CreatableSelect value={customerId || null} onChange={handleCustomerChange} allowCreate={false}
                    placeholder={customersLoading ? t('common:loading')
                      : customersError ? t('common:errorGeneric')
                      : customers.length === 0 ? t('common:noResults')
                      : t('common:select')}
                    options={customers.map(c => ({ value: String(c.id), label: c.name }))} />
                </Field>
                <Field label={t('fDepartment')}>
                  {/* Options stay empty until a customer is picked (mirrors the old
                      disabled select) — nothing selectable, not just visually greyed. */}
                  <CreatableSelect value={departmentId || null} onChange={setDepartmentId} allowCreate={false}
                    placeholder={!customerId ? t('pickCustomerFirst')
                      : departmentsLoading ? t('common:loading')
                      : departmentsError ? t('common:errorGeneric')
                      : departments.length === 0 ? t('common:noResults')
                      : t('common:select')}
                    options={!customerId ? [] : departments.map(d => ({ value: String(d.id), label: d.name }))} />
                </Field>
                <Field label={t('fAssignment')}><input style={INPUT} /></Field>
                <Field label={t('fContact')}><input style={INPUT} placeholder={t('contactPlaceholder')} /></Field>
              </div>

              <div style={cardHead}>{t('sectionLocation')}</div>
              <div style={cardBox}>
                <Field label={t('fAddress')}>
                  <textarea style={{ ...INPUT, resize: 'none', height: 56 }}
                    value={address} onChange={e => setAddress(e.target.value)} />
                </Field>
              </div>

              <div style={cardHead}>{t('sectionColor')}</div>
              <div style={cardBox}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {/* Icon-only swatch buttons need a real aria-label (§6) — the CSS
                      value itself isn't meaningful to a screen reader, so number them. */}
                  {COLORS.map((c, i) => (
                    <button key={c} type="button" onClick={() => setColor(c)} aria-label={`${t('sectionColor')} ${i + 1}`}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: 'none',
                        cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Midden: dienst details — same titled-card treatment; jobtype/open
                dienst are now searchable CreatableSelects. ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              <div style={cardHead}>{t('shift1')}</div>
              <div style={cardBox}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label={t('fJobtype')}>
                    <CreatableSelect value={jobType || null} onChange={setJobType} allowCreate={false}
                      placeholder={t('common:select')} options={functions} />
                  </Field>
                  <Field label={t('fOpenShift')}>
                    {/* Placeholder given even though a default is always selected — it
                        becomes the search box's accessible label once opened (§6). */}
                    <CreatableSelect value={openShiftMode} onChange={setOpenShiftMode} allowCreate={false}
                      placeholder={t('fOpenShift')}
                      options={[
                        { value: 'all', label: t('openAll') },
                        { value: 'favorites', label: t('openFavorites') },
                        { value: 'fixed', label: t('openFixed') },
                      ]} />
                  </Field>
                </div>
              </div>

              {/* Scheduled candidate */}
              <div style={cardHead}>{t('scheduledWorker')}</div>
              <div style={cardBox}>
                {candidate ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    border: `1px solid ${colorFor(getInitials(candidate.name))}40`, borderLeft: `4px solid ${colorFor(getInitials(candidate.name))}`,
                    borderRadius: 8, background: 'var(--bg)' }}>
                    <Avatar initials={getInitials(candidate.name)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{candidate.name}</div>
                      {candidate.functionTitle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{candidate.functionTitle}</div>}
                    </div>
                    <button onClick={() => setCandidate(null)} aria-label={t('common:cancel')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)',
                    borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('clickCandidate')}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={cardHead}>{t('notes')}</div>
              <div style={cardBox}>
                <textarea style={{ ...INPUT, height: 70, resize: 'none' }} placeholder={t('notePlaceholder')} aria-label={t('notePlaceholder')} />
              </div>

              {/* Assignment performance */}
              <div style={cardHead}>{t('performance')}</div>
              <div style={cardBox}>
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
