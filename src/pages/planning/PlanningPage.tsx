import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { monthName, formatDate } from './helpers'
import AddShiftModal from './AddShiftModal'
import { MonthView, WeekView, DayView, ListView } from './views'
import type { Shift, ShiftInput } from '@/types/planning'

// ── Dummy shifts ──────────────────────────────────────────────────────────────
const today = new Date()
const y = today.getFullYear(), m = today.getMonth()

const INITIAL_SHIFTS: Shift[] = [
  { id: 1, date: new Date(y, m, today.getDate()),     title: 'Nachtdienst', location: 'Rivas Zorggroep',   candidate: 'Ismail Eddahchouri', start: '22:00', end: '06:00', color: 'var(--color-primary)' },
  { id: 2, date: new Date(y, m, today.getDate()),     title: 'Dagdienst',   location: 'Yesway Zorg',       candidate: 'Elif Akagündüz',     start: '07:00', end: '15:00', color: 'var(--color-success)' },
  { id: 3, date: new Date(y, m, today.getDate() + 1), title: 'Avonddienst', location: 'WoonzorgGroep',     candidate: 'Rubina Milan',        start: '15:00', end: '23:00', color: 'var(--color-warning)' },
  { id: 4, date: new Date(y, m, today.getDate() + 2), title: 'Dagdienst',   location: 'Rivas Zorggroep',   candidate: 'Merel Van Muijlwijk', start: '07:00', end: '15:00', color: 'var(--color-success)' },
  { id: 5, date: new Date(y, m, today.getDate() + 4), title: 'Nachtdienst', location: 'Yesway Zorg',       candidate: 'Figen Ooijevaar',     start: '22:00', end: '06:00', color: 'var(--color-primary)' },
  { id: 6, date: new Date(y, m, today.getDate() - 1), title: 'Dagdienst',   location: 'WoonzorgGroep',     candidate: 'Petra Kuiters',       start: '07:00', end: '15:00', color: 'var(--color-success)' },
]



// ── Main planning page ────────────────────────────────────────────────────────
const VIEW_IDS = ['month', 'week', 'day', 'list']

export default function PlanningPage() {
  const { t } = useTranslation('planning')
  const [view,       setView]       = useState('month')
  const [current,    setCurrent]    = useState(new Date())
  const [shifts,     setShifts]     = useState<Shift[]>(INITIAL_SHIFTS)
  const [modal,      setModal]      = useState<Date | null>(null) // date to add shift for
  const todayDate = useMemo(() => new Date(), [])

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

  const handleAdd = (data: ShiftInput) => {
    setShifts(prev => [...prev, { ...data, id: Date.now() }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
        borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Today */}
        <button onClick={goToday}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)',
            borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          {t('today')}
        </button>

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
                color:      view === v ? '#fff' : 'var(--text)', cursor: 'pointer' }}>
              {t(`views.${v}`)}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button onClick={() => setModal(new Date())}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12,
            fontWeight: 600, background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} /> {t('addShift')}
        </button>
      </div>

      {/* ── Calendar body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'month' && <MonthView current={current} shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} />}
        {view === 'week'  && <WeekView  current={current} shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} />}
        {view === 'day'   && <DayView   current={current} shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} />}
        {view === 'list'  && <ListView  shifts={filteredShifts} today={todayDate} onDayClick={handleDayClick} />}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <AddShiftModal
          date={modal}
          onClose={() => setModal(null)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
