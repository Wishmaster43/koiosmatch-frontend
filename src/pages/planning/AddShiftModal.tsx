/**
 * AddShiftModal — the "plan a shift" dialog: order, shift times,
 * candidate search and notes. Its Field/Avatar/CandidateRow presentational
 * helpers live in ./AddShiftModalFields (CLAUDE.md §3 size split, 28-07). Extracted from
 * PlanningPage. PLAN-LOOKUP-1 (2026-07-16): the customer/department/job-title
 * selects and the candidate list used to be hardcoded Dutch demo data — see
 * ./hooks/useShiftLookups for the real sources and why the old fake
 * favourite/distance suggestion ranking was dropped instead of re-faked.
 *
 * Widened to the house WIDE_MODAL constant and every SectionHead regrouped into
 * a titled bordered card (Danny 27-07: "+ dienst ook nalopen" — every create
 * modal must share +Match/+Kandidaat's footprint); customer/department/jobtype
 * are searchable CreatableSelects, never a bare `<select>`. This
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
 *
 * PLANNING-PERSIST-1-staart verifier fixronde (2026-09-16): the create-then-
 * assign chain (see handleSave) moved to the shared `useAssignShiftCandidate`
 * hook (./hooks/useShiftStaffing) instead of an inline `api.post` — the same
 * unit ShiftStaffingDrawer's own assign mutation delegates to (§10, API calls
 * live in the hook/api layer, never inline in a component). It also now
 * remembers the created shift's id in state, so a retry after an assignment
 * failure re-runs only the assignment, never a second `POST /planning/shifts`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, AlertCircle } from 'lucide-react'
import { formatDate, toIsoDate } from './helpers'
import { useDateFormat } from '@/lib/datetime'
import { useFunctions } from '@/lib/useFunctions'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useShiftCustomers, useShiftDepartments, useShiftCandidateSearch } from './hooks/useShiftLookups'
import { usePlanningOrdersList } from './hooks/usePlanningOrders'
import { useCreatePlanningShift } from './hooks/usePlanningShifts'
import { useAssignShiftCandidate } from './hooks/useShiftStaffing'
import type { ShiftCandidateOption } from './hooks/useShiftLookups'
import { extractApiError } from '@/lib/extractApiError'
import { Field, Avatar, colorFor, getInitials } from './AddShiftModalFields'
import { INPUT } from './addShiftFieldStyles'
import AddShiftOrderColumn from './AddShiftOrderColumn'
import AddShiftCandidateColumn from './AddShiftCandidateColumn'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import Button from '@/components/ui/Button'
import type { ShiftInput } from '@/types/planning'
import { tint } from '@/lib/tint'
import { Caption, SectionTitle } from '@/components/ui/typography'
import DictationTextarea from '@/components/forms/DictationTextarea'

// ── Add Shift Modal ───────────────────────────────────────────────────────────
export default function AddShiftModal({ date, onClose, onAdd }: { date: Date; onClose: () => void; onAdd: (shift: ShiftInput) => void }) {
  const { t } = useTranslation('planning')
  // Active app locale (DATUM-1/LANE-B) — this modal is its own useDateFormat()
  // call site, so the header date follows the tenant's app language, not Dutch.
  const { locale } = useDateFormat()
  const [start,       setStart]       = useState('07:00')
  const [end,         setEnd]         = useState('15:00')
  const [jobType,     setJobType]     = useState('')
  const [orderId,     setOrderId]     = useState('')
  const [customerId,  setCustomerId]  = useState('')
  const [departmentId,setDepartmentId]= useState('')
  // Raw input text, not a number — Number('') is 0, not NaN, so a numeric
  // state var would silently turn "cleared" into a fake valid value; keeping
  // the raw string lets canSave/handleSave tell "empty" from "a real number".
  const [personCount, setPersonCount] = useState('1')
  const [candidate,   setCandidate]   = useState<ShiftCandidateOption | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  // Backend accepts a plain notes string (PlanningShiftController) — controlled
  // so typed text survives into the payload instead of being silently dropped.
  const [notes,       setNotes]       = useState('')

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
  // Shared with ShiftStaffingDrawer's own assign action (§10) — never a raw
  // inline api.post here.
  const assignCandidate = useAssignShiftCandidate()
  const [saveError, setSaveError] = useState<string | null>(null)
  // Verifier fixronde: once create succeeds this remembers the shift's id, so
  // a retry after an assignment failure only re-runs the assignment — never a
  // second POST /planning/shifts (which would leave an orphan duplicate shift).
  const [createdShiftId, setCreatedShiftId] = useState<string | null>(null)

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
  // person-count field must also hold a real value, not be mid-clear. Once
  // create has already succeeded (createdShiftId set) the order/person-count
  // gate no longer matters — a retry only re-runs the assignment.
  const canSave = createdShiftId
    ? !assignCandidate.isPending
    : Boolean(orderId) && personCountValid && !createShift.isPending

  // Runs the create POST, remembering the new shift's id so a later retry
  // (after an assignment failure) never re-creates the shift.
  const runCreate = async (): Promise<string> => {
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
    const created = await createShift.mutateAsync(body)
    setCreatedShiftId(created.id)
    return created.id
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaveError(null)
    try {
      // Verifier fixronde: a remembered createdShiftId means a PREVIOUS click
      // already created the shift and only the assignment failed — retry the
      // assignment alone, never POST /planning/shifts a second time.
      const shiftId = createdShiftId ?? await runCreate()
      // D8 fix: a picked candidate used to feed only local decoration (the
      // "scheduled worker" card + the onAdd echo) with no POST anywhere — the
      // real assignment route only exists once the shift has an id, so it
      // chains here, right after create, through the same shared
      // useAssignShiftCandidate hook ShiftStaffingDrawer's own assign
      // mutation delegates to (§10).
      if (candidate) {
        try {
          await assignCandidate.mutateAsync({ shiftId, candidateId: String(candidate.id) })
        } catch (assignErr) {
          setSaveError(extractApiError(assignErr, t('staffing.assignError')))
          return
        }
      }
      // Relays the created shift's local echo to the caller. The calendar
      // itself already refreshes on its own: useCreatePlanningShift's onSuccess
      // invalidates the ['planning','board'] query, so PlanningPage's usePlanningBoard
      // refetches without this callback's help — onAdd exists only so a future/other
      // caller can react to a create without reaching into react-query's cache.
      // The calendar itself derives a shift's colour from its open/filled state
      // (PlanningPage's mapBoardShift, §4) — this echo is never rendered, so an
      // empty string satisfies ShiftInput's `color` field without inventing a UI ink.
      onAdd({ title: '', location: customerName, candidate: candidate?.name || '', start, end, color: '', date, orderId, notes })
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
              title={!orderId && !createdShiftId ? t('pickOrderFirst') : undefined}>
              <Save size={13} /> {(createShift.isPending || assignCandidate.isPending) ? t('common:saving') : t('common:save')}
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

            {/* ── Links: order info — extracted to AddShiftOrderColumn (SIZE-SPLIT-B). ── */}
            <AddShiftOrderColumn
              t={t} orderId={orderId} handleOrderChange={handleOrderChange} orders={orders}
              ordersLoading={ordersLoading} ordersError={ordersError}
              customerId={customerId} handleCustomerChange={handleCustomerChange} customers={customers}
              customersLoading={customersLoading} customersError={customersError}
              departmentId={departmentId} setDepartmentId={setDepartmentId} departments={departments}
              departmentsLoading={departmentsLoading} departmentsError={departmentsError} departmentCustomerId={departmentCustomerId}
            />

            {/* ── Midden: dienst details — same titled-card treatment; jobtype is a
                searchable CreatableSelect. Each cardHead+cardBox pair is its own
                flex item (gap:16), same reasoning as the left column. ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px',
              display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={cardHead}>{t('shift1')}</div>
                <div style={cardBox}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
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

                  <Field label={t('fJobtype')}>
                    <CreatableSelect value={jobType || null} onChange={setJobType} allowCreate={false}
                      placeholder={t('common:select')} options={functions} />
                  </Field>
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
                  {/* D9 fix: user-facing prose goes through the house dictation textarea
                      (§3A RICH-TEXT-FREE-TEXT), not a bare <textarea> — mirrors
                      AddOrderModal's own notes field (plain-text storage, so
                      DictationTextarea, not the HTML-producing RichTextEditor). */}
                  <DictationTextarea value={notes} onChange={setNotes} rows={3} style={{ resize: 'none' }}
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

            {/* ── Rechts: kandidaat zoeken — extracted to AddShiftCandidateColumn (SIZE-SPLIT-B). ── */}
            <AddShiftCandidateColumn
              t={t} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              candidatesLoading={candidatesLoading} candidatesError={candidatesError} candidates={candidates}
              candidate={candidate} setCandidate={setCandidate}
            />
          </div>
    </FloatingPanel>
  )
}
