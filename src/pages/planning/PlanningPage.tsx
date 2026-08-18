import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { ChevronLeft, ChevronRight, Plus, Info, AlertCircle } from 'lucide-react'
import { monthName, formatDate, getViewRange } from './helpers'
import { usePlanningBoard } from './hooks/usePlanningBoard'
import { useDateFormat } from '@/lib/datetime'
import AddShiftModal from './AddShiftModal'
import ShiftStaffingDrawer from './ShiftStaffingDrawer'
import { MonthView, WeekView, DayView, ListView } from './views'
import type { Shift } from '@/types/planning'
import type { PlanningBoardShift } from './hooks/usePlanningBoard'
import Button from '@/components/ui/Button'

// ── Real shifts (PLANNING-PERSIST-1 follow-up — read side) ────────────────────
// This calendar used to render six hardcoded, always-the-same demo rows,
// entirely disconnected from any tenant's actual schedule. It now fetches the
// tenant's real shifts via GET /planning/board (PlanningBoardController /
// PlanningBoardBuilder — verified against the live routes/controller today) and
// maps that resource's own fields onto the flat `Shift` shape the four calendar
// views already render. Nothing here is invented: title/location/candidate/
// times all come straight off the board resource; a shift with nobody on it
// renders with an empty candidate line (open_spots > 0), never a fabricated name.
//
// The CREATE side stays a separate, still-gated concern: AddShiftModal's Save
// button is disabled (no order-creation flow exists in this UI yet — see its own
// header) — this page's banner below now only speaks to THAT, not to what's shown.
function mapBoardShift(s: PlanningBoardShift, formatTime: (v: string | null | undefined) => string): Shift {
  const candidateNames = s.assigned.map(a => a.candidate).filter((n): n is string => !!n).join(', ')
  return {
    id: s.id,
    date: s.startTime ? new Date(s.startTime) : new Date(),
    title: s.function || s.shiftType || '',
    location: s.location || s.customer || '',
    candidate: candidateNames,
    start: formatTime(s.startTime),
    end: formatTime(s.endTime),
    // Open (still needs people) vs filled — the one real signal the board
    // resource gives us; never a per-shift-type palette we'd have to invent.
    color: s.openShift ? 'var(--color-warning)' : 'var(--color-success)',
    openSpots: s.openSpots,
    numberPersons: s.numberPersons,
  }
}

// ── Main planning page ────────────────────────────────────────────────────────
const VIEW_IDS = ['month', 'week', 'day', 'list']

export default function PlanningPage() {
  const { t } = useTranslation('planning')
  const { formatTime } = useDateFormat()
  const [view,       setView]       = useState('month')
  const [current,    setCurrent]    = useState(new Date())
  const [modal,      setModal]      = useState<Date | null>(null) // date to add shift for
  // SHIFT-STAFF-1: the shift id whose staffing drawer is open (assign/unassign/
  // cancel/checkout on the real API) — separate from `modal` (still-gated add).
  const [staffingId, setStaffingId] = useState<Shift['id'] | null>(null)
  const todayDate = useMemo(() => new Date(), [])

  // Real shifts for whatever window the active view can show (§9: every
  // entity-keyed load is refetched on view/date change via the query key).
  const { from, to } = useMemo(() => getViewRange(view, current), [view, current])
  const { shifts: boardShifts, loading: shiftsLoading, error: shiftsError } = usePlanningBoard(from, to)
  const shifts = useMemo(() => boardShifts.map(s => mapBoardShift(s, formatTime)), [boardShifts, formatTime])

  // Right-panel filters (shift type + location). Registering them makes the shared
  // topbar filter button appear and feeds the ReportFilterSidebar — same as the
  // candidates/applications pages.
  const [selectedShift,    setSelectedShift]    = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string[]>([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  const shiftOptions    = useMemo(() => [...new Set(shifts.map(s => s.title))].map(v => ({ value: v, label: v, count: shifts.filter(s => s.title === v).length })), [shifts])
  const locationOptions = useMemo(() => [...new Set(shifts.map(s => s.location))].map(v => ({ value: v, label: v, count: shifts.filter(s => s.location === v).length })), [shifts])

  const filterGroups = useMemo(() => [
    { key: 'shift',    label: t('filters.shift'),    selected: selectedShift,    options: shiftOptions,
      onToggle: (v: string) => setSelectedShift(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'location', label: t('filters.location'), selected: selectedLocation, options: locationOptions,
      onToggle: (v: string) => setSelectedLocation(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, selectedShift, selectedLocation, shiftOptions, locationOptions])

  useEffect(() => {
    registerFilters('planning-page', filterGroups)
    return () => unregisterFilters('planning-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Apply the active filters to the shifts shown in every view.
  const filteredShifts = useMemo(() => shifts.filter(s => {
    if (selectedShift.length    && !selectedShift.includes(s.title))       return false
    if (selectedLocation.length && !selectedLocation.includes(s.location)) return false
    return true
  }), [shifts, selectedShift, selectedLocation])

  const navigate = (dir: number) => {
    const d = new Date(current)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setCurrent(d)
  }

  const goToday = () => setCurrent(new Date())

  const headerLabel = () => {
    if (view === 'month') return `${monthName(current.getMonth())} ${current.getFullYear()}`
    if (view === 'week') {
      const dow = (current.getDay() + 6) % 7
      const start = new Date(current); start.setDate(current.getDate() - dow)
      const end   = new Date(start);   end.setDate(start.getDate() + 6)
      return `${start.getDate()} ${monthName(start.getMonth())} – ${end.getDate()} ${monthName(end.getMonth())} ${end.getFullYear()}`
    }
    return formatDate(current)
  }

  const handleDayClick = (date: Date) => setModal(date)

  // AddShiftModal's Save is disabled (its own header explains why: no
  // order-creation flow exists yet), so this never actually fires from a real
  // click — kept only so the prop stays wired and reactivates for free the
  // moment a real create path lands, per its own PLANNING-PERSIST-1 comment.
  // It deliberately does NOT touch `shifts` anymore: that list is server data
  // now (usePlanningBoard), not local state a demo row could be appended to.
  // Takes no parameter on purpose: an unused named argument only exists to be
  // linted away later, and a no-arg function still satisfies the prop's type.
  const handleAdd = () => {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
        borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Today */}
        <Button variant="secondary" size="sm" onClick={goToday}>
          {t('today')}
        </Button>

        {/* Prev / Next */}
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', padding: 6, border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          <ChevronLeft size={15} />
        </button>
        <button onClick={() => navigate(1)}
          style={{ display: 'flex', padding: 6, border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          <ChevronRight size={15} />
        </button>

        {/* Period label */}
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          {headerLabel()}
        </span>

        {/* View switcher */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {VIEW_IDS.map((v, i) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: view === v ? 600 : 400,
                border: 'none', borderRight: i < VIEW_IDS.length - 1 ? '1px solid var(--border)' : 'none',
                background: view === v ? 'var(--color-primary)' : 'var(--surface)',
                color:      view === v ? 'var(--color-on-accent)' : 'var(--text)', cursor: 'pointer' }}>
              {t(`views.${v}`)}
            </button>
          ))}
        </div>

        {/* Add button */}
        <Button variant="primary" size="sm" onClick={() => setModal(new Date())}>
          <Plus size={14} /> {t('addShift')}
        </Button>
      </div>

      {/* Not-yet-persisted gate (PLANNING-PERSIST-1, §3) — only the ADD side is
          still fake (AddShiftModal's Save stays disabled); the shifts below are
          this tenant's real schedule now (usePlanningBoard). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 20px',
        background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)', flexShrink: 0 }}>
        <Info size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('previewNotice')}</span>
      </div>

      {/* Load-error state (§3: four honest states) — the board fetch failed;
          never silently show a stale/empty calendar without saying why. */}
      {shiftsError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
          background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', flexShrink: 0 }}>
          <AlertCircle size={12} style={{ color: 'var(--color-danger)', flexShrink: 0 }} aria-hidden="true" />
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('loadErrorShifts')}</span>
        </div>
      )}

      {/* ── Calendar body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {shiftsLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: 'var(--text-muted)' }}>
            {t('common:loading')}
          </div>
        ) : (
          <>
            {view === 'month' && <MonthView current={current} shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} onShiftClick={setStaffingId} />}
            {view === 'week'  && <WeekView  current={current} shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} onShiftClick={setStaffingId} />}
            {view === 'day'   && <DayView   current={current} shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} onShiftClick={setStaffingId} />}
            {view === 'list'  && <ListView  shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} onShiftClick={setStaffingId} />}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <AddShiftModal
          date={modal}
          onClose={() => setModal(null)}
          onAdd={handleAdd}
        />
      )}

      {/* SHIFT-STAFF-1: real staffing drawer for the clicked shift — looked up
          from the raw board rows (boardShifts), not the flattened calendar
          `Shift` shape, since staffing needs the full assignee/schedule ids. */}
      {staffingId != null && (() => {
        const raw = boardShifts.find(s => s.id === staffingId)
        return raw ? <ShiftStaffingDrawer shift={raw} onClose={() => setStaffingId(null)} /> : null
      })()}
    </div>
  )
}
