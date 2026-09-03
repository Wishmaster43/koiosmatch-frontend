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
 * PLANNING-PERSIST-1 (CMFE audit 2026-07-28): `onAdd` used to only ever reach
 * PlanningPage's local, in-memory shift array — no PATCH/POST call anywhere in
 * this component. A real backend Planning API exists (`/planning/orders`,
 * `/planning/shifts`, `/planning/schedules`, `/planning/assignments`).
 *
 * PLANNING-ORDER-CREATE-1 (2026-08-14): the order-to-hang-a-shift-on gap closed
 * (OrdersPanel + AddOrderModal, POST /planning/orders) — this modal's
 * "sectionOrder" card gained a real, searchable order picker.
 *
 * PLANNING-PERSIST-1-staart (CMFE audit 2026-09-04): the remaining gap — Save
 * itself — is now wired. `handleSave` POSTs to `/planning/shifts`
 * (useCreatePlanningShift, verified against PlanningShiftController::validated,
 * read-only) with the exact fields that route accepts: the required
 * `planning_order_id` + `start_time`, and the optional `customer_department_id`
 * / `function` / `end_time` / `number_persons` / `notes` this form already
 * collects. Save stays disabled only while the one required picker (order) is
 * empty, and shows loading/error/success instead of the old permanent notice.
 *
 * PLANNING-PERSIST-1-staart fixronde (CMFE audit 2026-09-04, same day): two
 * data-coherence corrections on top of the above. (1) `customer_department_id`
 * used to come from an independently-picked customer, while the backend
 * validates it against the SELECTED ORDER's own customer — `departmentCustomerId`
 * now derives from the picked order (falling back to the manual pick only while
 * no order is chosen), and `handleOrderChange` resets any stale department.
 * (2) the number-of-people field is now a raw string (`personCount`), not a
 * number — `Number('')` is `0`, not `NaN`, so the old numeric state silently
 * turned "cleared" into a fake valid `0`; `personCountValid` gates both Save
 * and the submitted body.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, Search, AlertCircle } from 'lucide-react'
import { formatDate, toIsoDate } from './helpers'
import { useDateFormat } from '@/lib/datetime'
import { useFunctions } from '@/lib/useFunctions'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useShiftCustomers, useShiftDepartments, useShiftCandidateSearch } from './hooks/useShiftLookups'
import { usePlanningOrdersList } from './hooks/usePlanningOrders'
import { useCreatePlanningShift } from './hooks/usePlanningShifts'
import type { ShiftCandidateOption } from './hooks/useShiftLookups'
import { extractApiError } from '@/lib/extractApiError'
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
  // Raw input text, not a number — Number('') is 0, not NaN, so a numeric
  // state var would silently turn "cleared" into a fake valid value; keeping
  // the raw string lets canSave/handleSave tell "empty" from "a real number".
  const [personCount, setPersonCount] = useState('1')
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
  const { functions } = useFunctions()
  // PLANNING-ORDER-CREATE-1: the real order list, so a just-created order is
  // immediately pickable here — no demo/hardcoded options.
  const { orders, loading: ordersLoading, error: ordersError } = usePlanningOrdersList()
  // PLANNING-PERSIST-1-staart: PlanningShiftController validates
  // customer_department_id against the ORDER's own customer (planning_order_id),
  // never the independently-picked one — so department options are scoped to
  // the SELECTED ORDER's customer, falling back to the manual customer pick
  // only while no order has been chosen yet.
  const selectedOrder = orders.find(o => String(o.id) === orderId)
  const departmentCustomerId = selectedOrder?.customer_id != null ? String(selectedOrder.customer_id) : customerId
  const { departments, loading: departmentsLoading, error: departmentsError } = useShiftDepartments(departmentCustomerId)
  const { candidates, loading: candidatesLoading, error: candidatesError } = useShiftCandidateSearch(searchQuery)
  // PLANNING-PERSIST-1-staart: the real create mutation — POST /planning/shifts.
  const createShift = useCreatePlanningShift()
  const [saveError, setSaveError] = useState<string | null>(null)

  const customerName = customers.find(c => String(c.id) === customerId)?.name ?? ''

  // A new customer invalidates the previously picked department (it belonged to
  // the old customer) — mirrors AddOpportunityModal's cascade reset.
  const handleCustomerChange = (id: string) => { setCustomerId(id); setDepartmentId('') }

  // A new order can point at a different customer than the previous one, so any
  // previously picked department may no longer belong to it — reset it here
  // rather than letting a now-mismatched department reach the save payload.
  const handleOrderChange = (id: string) => { setOrderId(id); setDepartmentId('') }

  // Number-of-people is a raw string (see the state comment above) — only a
  // finite integer >= 1 is a real value; an empty/garbage field omits the key
  // entirely rather than sending a fabricated 0/NaN.
  const personCountNum = Number(personCount)
  const personCountValid = personCount.trim() !== '' && Number.isInteger(personCountNum) && personCountNum >= 1

  // The order is the ONE field PlanningShiftController requires beyond
  // start_time (always filled, default '07:00') — Save stays disabled until
  // it is picked, an honest gate instead of the old permanent notice. The
  // person-count field must also hold a real value, not be mid-clear.
  const canSave = Boolean(orderId) && personCountValid && !createShift.isPending

  const handleSave = async () => {
    if (!canSave) return
    setSaveError(null)
    // Exactly the fields PlanningShiftController::validated() accepts —
    // combining the calendar date with the picked start/end time strings.
    const body = {
      planning_order_id: orderId,
      customer_department_id: departmentId || null,
      function: jobType || null,
      start_time: `${toIsoDate(date)}T${start}:00`,
      end_time: `${toIsoDate(date)}T${end}:00`,
      number_persons: personCountNum,
      notes: notes || null,
    }
    try {
      await createShift.mutateAsync(body)
      // Relays the created shift's local echo to the caller. The calendar
      // itself already refreshes on its own: useCreatePlanningShift's onSuccess
      // invalidates the ['planning','board'] query, so PlanningPage's usePlanningBoard
      // refetches without this callback's help — onAdd exists only so a future/other
      // caller can react to a create without reaching into react-query's cache.
      onAdd({ title, location: customerName, candidate: candidate?.name || '', start, end, color, date, orderId, notes })
      onClose()
    } catch (err) {
      setSaveError(extractApiError(err, t('common:errorGeneric')))
    }
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
            {/* PLANNING-PERSIST-1-staart: real POST /planning/shifts. Disabled only
                while the required order picker is empty, or while the request is
                in flight — an honest gate, not a permanent notice. */}
            <Button variant="primary" onClick={handleSave} disabled={!canSave}
              title={!orderId ? t('pickOrderFirst') : undefined}>
              <Save size={13} /> {createShift.isPending ? t('common:saving') : t('common:save')}
            </Button>
          </div>
        </div>
      }>

          {/* Save-failure notice (PLANNING-PERSIST-1-staart, §3 honest errors) — only
              shown once a save actually failed; the calm not-yet-persisted banner it
              replaces is gone now that Save really persists. */}
          {saveError && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 20px',
              background: tint('var(--color-danger)', 8), flexShrink: 0 }}>
              <AlertCircle size={12} style={{ color: 'var(--color-danger-text)', flexShrink: 0 }} aria-hidden="true" />
              <Caption style={{ color: 'var(--color-danger-text)' }}>{saveError}</Caption>
            </div>
          )}

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
                    <CreatableSelect value={orderId || null} onChange={handleOrderChange} allowCreate={false}
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
                    {/* Options stay empty until a customer is known — either picked
                        directly, or derived from the selected order's own customer
                        (departmentCustomerId above) — nothing selectable, not just
                        visually greyed. */}
                    <CreatableSelect value={departmentId || null} onChange={setDepartmentId} allowCreate={false}
                      placeholder={!departmentCustomerId ? t('pickCustomerFirst')
                        : departmentsLoading ? t('common:loading')
                        : departmentsError ? t('common:errorGeneric')
                        : departments.length === 0 ? t('common:noResults')
                        : t('common:select')}
                      options={!departmentCustomerId ? [] : departments.map(d => ({ value: String(d.id), label: d.name }))} />
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
                        onChange={e => setPersonCount(e.target.value)} />
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
