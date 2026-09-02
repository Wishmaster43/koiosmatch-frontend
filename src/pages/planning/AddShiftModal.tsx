/**
 * AddShiftModal — the "plan a shift" dialog: order/location/colour, shift times,
 * candidate search and notes. Its Field/Avatar/CandidateRow presentational
 * helpers live in ./AddShiftModalFields (CLAUDE.md §3 size split, 28-07). Extracted from
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
 *
 * Card chrome adopted from the shared `@/components/ui/modalCards` module
 * (CLAUDE.md §11, 28-07 dedup pass): this file used to hand-roll its own
 * cardHead/cardBox (fontWeight 700/letterSpacing 0.07em/marginBottom 6, and a
 * plain-block cardBox with marginBottom:14 for inter-card spacing) — a real
 * drift from every other wide create-modal's cardHead/cardBox. Adopting the
 * shared truth means each card is now its own flex item (gap:16 on the two form
 * columns) instead of relying on cardBox's own marginBottom, and the local
 * `Field` helper's redundant marginBottom:10 was dropped — cardBox's own
 * gap:12 now spaces stacked fields, matching how @/components/forms/fields'
 * shared Field (used by every other modal) already works.
 *
 * PLANNING-PERSIST-1 (CMFE audit 2026-07-28): `onAdd` only ever reached
 * PlanningPage's local, in-memory shift array — there is no PATCH/POST call
 * anywhere in this component, and PlanningPage itself never fetches shifts from
 * a server either (see its own file header). A real backend Planning API exists
 * (`/planning/orders`, `/planning/shifts`, `/planning/schedules`,
 * `/planning/assignments`) but its create bodies and success responses aren't in
 * the generated OpenAPI spec, and this modal's flat order/shift/candidate form
 * doesn't map onto that order→shift→schedule model without new product
 * decisions. Per §3 (no fake affordances), the Save button below stays disabled
 * with an honest, translated notice instead of inventing that integration —
 * `handleSave` itself is kept so it reactivates for free the moment a real save
 * path lands.
 *
 * PLANNING-ORDER-CREATE-1 (2026-08-14): the ONE previously missing piece — an
 * order to hang a shift on — is now real (OrdersPanel + AddOrderModal, POST
 * /planning/orders). This modal's "sectionOrder" card now includes a real,
 * searchable order picker sourced from usePlanningOrdersList (no demo data),
 * so a freshly created order is immediately selectable here. The picker is
 * local UI state, same as every other field in this form, until POST
 * /planning/shifts itself gets wired (still gated by the notice above — the
 * shift body/response shape work is separate from the order-creation gap).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, Search, Info } from 'lucide-react'
import { formatDate } from './helpers'
import { useDateFormat } from '@/lib/datetime'
import { useFunctions } from '@/lib/useFunctions'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useShiftCustomers, useShiftDepartments, useShiftCandidateSearch } from './hooks/useShiftLookups'
import { usePlanningOrdersList } from './hooks/usePlanningOrders'
import type { ShiftCandidateOption } from './hooks/useShiftLookups'
import { Field, Avatar, CandidateRow, colorFor, getInitials } from './AddShiftModalFields'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import Button from '@/components/ui/Button'
import type { ShiftInput } from '@/types/planning'
import { tint } from '@/lib/tint'
import { Caption, SectionTitle } from '@/components/ui/typography'

// ── Field helpers — house footprint (padding '8px 11px', fontSize 13,
// borderRadius 8, §3A/§4) so this modal's inputs match every other create form,
// even though its 3-column workspace stays its own (genuinely different) layout.
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- shared style OBJECT applied directly to native <input>/<textarea> elements throughout this file; a form field's own text colour must sit on the element itself, not on a wrapping BodyText atom
const INPUT: CSSProperties = { padding: '8px 11px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  outline: 'none', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }

// ── Add Shift Modal ───────────────────────────────────────────────────────────
export default function AddShiftModal({ date, onClose, onAdd }: { date: Date; onClose: () => void; onAdd: (shift: ShiftInput) => void }) {
  const { t } = useTranslation('planning')
  // Active app locale (DATUM-1/LANE-B) — this modal is its own useDateFormat()
  // call site, so the header date follows the tenant's app language, not Dutch.
  const { locale } = useDateFormat()
  const [title,       setTitle]       = useState('')
  const [start,       setStart]       = useState('07:00')
  const [end,         setEnd]         = useState('15:00')
  const [jobType,     setJobType]     = useState('')
  const [orderId,     setOrderId]     = useState('')
  const [customerId,  setCustomerId]  = useState('')
  const [departmentId,setDepartmentId]= useState('')
  const [address,     setAddress]     = useState('')
  const [personCount, setPersonCount] = useState(1)
  const [candidate,   setCandidate]   = useState<ShiftCandidateOption | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [color,       setColor]       = useState('var(--color-success)')
  // Backend accepts a plain notes string (PlanningShiftController) — controlled
  // so typed text survives into the payload instead of being silently dropped.
  const [notes,       setNotes]       = useState('')
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
  // PLANNING-ORDER-CREATE-1: the real order list, so a just-created order is
  // immediately pickable here — no demo/hardcoded options.
  const { orders, loading: ordersLoading, error: ordersError } = usePlanningOrdersList()
  const { candidates, loading: candidatesLoading, error: candidatesError } = useShiftCandidateSearch(searchQuery)

  const customerName = customers.find(c => String(c.id) === customerId)?.name ?? ''

  // A new customer invalidates the previously picked department (it belonged to
  // the old customer) — mirrors AddOpportunityModal's cascade reset.
  const handleCustomerChange = (id: string) => { setCustomerId(id); setDepartmentId('') }

  const handleSave = () => {
    // orderId travels with the payload from day one, even while onAdd itself is
    // still the local in-memory sink — so wiring the real POST later is a body
    // change, not a hunt for where the picked order went.
    onAdd({ title, location: customerName, candidate: candidate?.name || '', start, end, color, date, orderId, notes })
    onClose()
  }

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable
    // header, SE-resize, remembered position. The bespoke header (title + date +
    // the honest disabled Save) rides in the panel's drag handle; the panel's own
    // X replaces the old bespoke close button (same onClose flow). The 3-column
    // planner keeps its own layout via scrollBody={false}.
    <FloatingPanel open onClose={onClose} ariaLabel={t('addShift')}
      persistKey="add-shift" scrollBody={false}
      width="92vw" maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('addShift')}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{formatDate(date, locale)}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {/* PLANNING-PERSIST-1 (§3) — disabled + an honest title until a real save
                path exists (see the file header); onClick stays wired so it reactivates
                for free the moment that path lands. */}
            <Button variant="primary" onClick={handleSave} disabled title={t('previewSaveTitle')}>
              <Save size={13} /> {t('common:save')}
            </Button>
          </div>
        </div>
      }>

          {/* Not-yet-persisted gate (PLANNING-PERSIST-1, §3) — mirrors the calm notice
              pattern from candidates/drawer/PlanningTab.tsx: Info icon + italic muted
              text, so opening this modal directly (without seeing PlanningPage's own
              banner) still tells the truth about what Save does right now. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 20px',
            background: tint('var(--text-muted)', 8), flexShrink: 0 }}>
            <Info size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
            <Caption style={{ fontStyle: 'italic' }}>{t('previewNotice')}</Caption>
          </div>

          {/* Body: 3 kolommen */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* ── Links: order info — each SectionHead became a titled bordered
                card (Danny 27-07); customer/department are searchable
                CreatableSelects, never a bare `<select>`. Each cardHead+cardBox
                pair is its own flex item (gap:16) — the shared cardBox no longer
                carries its own marginBottom, mirroring every other wide modal. ── */}
            <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
              background: 'var(--surface)', overflowY: 'auto', padding: '14px 14px',
              display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={cardHead}>{t('sectionOrder')}</div>
                <div style={cardBox}>
                  <Field label={t('order.listTitle')}>
                    <CreatableSelect value={orderId || null} onChange={setOrderId} allowCreate={false}
                      clearable clearLabel={t('order.noOrder')}
                      placeholder={ordersLoading ? t('common:loading') : ordersError ? t('common:errorGeneric') : orders.length === 0 ? t('common:noResults') : t('common:select')}
                      options={orders.map(o => ({ value: String(o.id), label: o.subject || o.function || o.reference || o.client || t('order.listTitle') }))} />
                  </Field>
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
              </div>

              <div>
                <div style={cardHead}>{t('sectionLocation')}</div>
                <div style={cardBox}>
                  <Field label={t('fAddress')}>
                    <textarea style={{ ...INPUT, resize: 'none', height: 56 }}
                      value={address} onChange={e => setAddress(e.target.value)} />
                  </Field>
                </div>
              </div>

              <div>
                <div style={cardHead}>{t('sectionColor')}</div>
                <div style={cardBox}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* Icon-only swatch buttons need a real aria-label (§6) — the CSS
                        value itself isn't meaningful to a screen reader, so number them.
                        HUISSTIJL-1: left hand-styled — each swatch's fill IS the picked
                        colour value (data), not a Button identity. */}
                    {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
                    {COLORS.map((c, i) => (
                      <button key={c} type="button" onClick={() => setColor(c)} aria-label={`${t('sectionColor')} ${i + 1}`}
                        style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: 'none',
                          cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                    ))}
                    {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Midden: dienst details — same titled-card treatment; jobtype/open
                dienst are now searchable CreatableSelects. Each cardHead+cardBox
                pair is its own flex item (gap:16), same reasoning as the left column. ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px',
              display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
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
              </div>

              {/* Scheduled candidate */}
              <div>
                <div style={cardHead}>{t('scheduledWorker')}</div>
                <div style={cardBox}>
                  {candidate ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      border: `1px solid ${tint(colorFor(getInitials(candidate.name)), 25)}`, borderLeft: `4px solid ${colorFor(getInitials(candidate.name))}`,
                      borderRadius: 8, background: 'var(--bg)' }}>
                      <Avatar initials={getInitials(candidate.name)} />
                      <div style={{ flex: 1 }}>
                        <SectionTitle as="div">{candidate.name}</SectionTitle>
                        {candidate.functionTitle && <Caption as="div">{candidate.functionTitle}</Caption>}
                      </div>
                      <Button variant="ghost" iconOnly size="sm" onClick={() => setCandidate(null)} aria-label={t('common:cancel')}>
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)',
                      borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('clickCandidate')}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <div style={cardHead}>{t('notes')}</div>
                <div style={cardBox}>
                  <textarea style={{ ...INPUT, height: 70, resize: 'none' }} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={t('notePlaceholder')} aria-label={t('notePlaceholder')} />
                </div>
              </div>

              {/* Assignment performance */}
              <div>
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
                  <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--color-danger-text)' }}>{t('common:errorGeneric')}</div>
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
    </FloatingPanel>
  )
}
