/**
 * Planning calendar views — month / week / day / list renderings of the shift
 * calendar. Presentational: each takes props (current/shifts/today/onDayClick) and
 * renders cells via the shared ShiftPill. Extracted from PlanningPage.
 */
import { useTranslation } from 'react-i18next'
import { Clock, MapPin, User } from 'lucide-react'
import { isSameDay, WEEKDAYS_MON, formatDate } from './helpers'
import { interactive } from '@/lib/a11y'
import type { Shift } from '../../types/planning'

interface ViewProps { current: Date; shifts: Shift[]; today: Date; onDayClick: (date: Date) => void }

// ── Shift pill ────────────────────────────────────────────────────────────────
function ShiftPill({ shift, small }: { shift: Shift; small?: boolean }) {
  return (
    <div style={{ background: shift.color + '20', borderLeft: `3px solid ${shift.color}`,
      borderRadius: 4, padding: small ? '2px 5px' : '3px 7px', marginBottom: 2,
      cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ fontSize: small ? 10 : 11, fontWeight: 600, color: shift.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {shift.start} {shift.title}
      </div>
      {!small && shift.candidate && (
        <div style={{ fontSize: 10, color: shift.color + 'CC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shift.candidate}
        </div>
      )}
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────
export function MonthView({ current, shifts, today, onDayClick }: ViewProps) {
  const { t } = useTranslation('planning')
  const year  = current.getFullYear()
  const month = current.getMonth()
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)

  // Start grid on Monday
  const startDay = (first.getDay() + 6) % 7
  const days: Array<{ date: Date; outside: boolean }> = []
  for (let i = 0; i < startDay; i++) {
    const d = new Date(year, month, 1 - (startDay - i))
    days.push({ date: d, outside: true })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), outside: false })
  }
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - last.getDate() - startDay + 1)
    days.push({ date: d, outside: true })
  }

  const weeks: Array<Array<{ date: Date; outside: boolean }>> = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  const WEEK_DAYS = WEEKDAYS_MON

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
        {WEEK_DAYS.map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11,
            fontWeight: 600, color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
            borderBottom: '1px solid var(--border)', minHeight: 110 }}>
            {week.map(({ date, outside }, di) => {
              const isToday  = isSameDay(date, today)
              const dayShifts = shifts.filter(s => isSameDay(s.date, date))
              return (
                <div key={di}
                  onClick={() => onDayClick(date)}
                  style={{ borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                    padding: '6px 6px 4px', background: outside ? 'var(--bg)' : 'var(--surface)',
                    cursor: 'pointer', minHeight: 110, position: 'relative' }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = outside ? '#f0f0f0' : 'var(--hover-bg)' }}
                  onMouseLeave={e => e.currentTarget.style.background = outside ? 'var(--bg)' : 'var(--surface)' }>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 4, fontSize: 12, fontWeight: isToday ? 700 : 400,
                    background: isToday ? 'var(--color-primary)' : 'transparent',
                    color: outside ? 'var(--text-muted)' : isToday ? '#fff' : 'var(--text)',
                  }}>
                    {date.getDate()}
                  </div>
                  {dayShifts.slice(0, 3).map(s => <ShiftPill key={s.id} shift={s} small />)}
                  {dayShifts.length > 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 2 }}>{t('more', { count: dayShifts.length - 3 })}</div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────
export function WeekView({ current, shifts, today, onDayClick }: ViewProps) {
  const startOfWeek = new Date(current)
  const dow = (current.getDay() + 6) % 7
  startOfWeek.setDate(current.getDate() - dow)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })
  const WEEK_LABELS = WEEKDAYS_MON

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '2px solid var(--border)' }}>
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today)
          return (
            <div key={i} style={{ borderRight: i < 6 ? '1px solid var(--border)' : 'none', padding: '8px 6px' }}>
              <div style={{ textAlign: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{WEEK_LABELS[i]}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--color-primary)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text)', fontSize: 14, fontWeight: isToday ? 700 : 400 }}>
                  {d.getDate()}
                </div>
              </div>
              <div {...interactive(() => onDayClick(d))} style={{ minHeight: 300, cursor: 'pointer', padding: '2px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {shifts.filter(s => isSameDay(s.date, d)).map(s => (
                  <ShiftPill key={s.id} shift={s} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────
export function DayView({ current, shifts, today, onDayClick }: ViewProps) {
  const { t } = useTranslation('planning')
  const dayShifts = shifts.filter(s => isSameDay(s.date, current))
  const isToday = isSameDay(current, today)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          {isToday && <span style={{ color: 'var(--color-primary)', marginRight: 8 }}>{t('today')} —</span>}
          {formatDate(current)}
        </div>
      </div>

      {dayShifts.length === 0
        ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('noShiftsPlanned')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('addHint')}</div>
            <button onClick={() => onDayClick(current)}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, background: 'var(--color-primary)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + {t('addShift')}
            </button>
          </div>
        )
        : (
          <>
            {dayShifts.map(s => (
              <div key={s.id} style={{ display: 'flex', gap: 14, padding: '14px 16px',
                border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`,
                borderRadius: 10, marginBottom: 10, background: 'var(--surface)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      <Clock size={12} /> {s.start} – {s.end}
                    </span>
                    {s.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <MapPin size={12} /> {s.location}
                      </span>
                    )}
                    {s.candidate && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <User size={12} /> {s.candidate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => onDayClick(current)}
              style={{ width: '100%', padding: '9px', fontSize: 13, border: '1px dashed var(--border)',
                borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
              + {t('addShift')}
            </button>
          </>
        )
      }
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────
export function ListView({ shifts, today, onDayClick }: Omit<ViewProps, 'current'>) {
  const { t } = useTranslation('planning')
  const sorted = [...shifts].sort((a, b) => a.date.getTime() - b.date.getTime())
  const grouped: Record<string, { date: Date; shifts: Shift[] }> = {}
  sorted.forEach(s => {
    const key = s.date.toDateString()
    if (!grouped[key]) grouped[key] = { date: s.date, shifts: [] }
    grouped[key].shifts.push(s)
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
      {Object.values(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          {t('noShiftsPlannedDot')}
        </div>
      )}
      {Object.values(grouped).map(({ date, shifts: ds }) => {
        const isToday = isSameDay(date, today)
        return (
          <div key={date.toDateString()} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
              borderBottom: '2px solid var(--border)', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700,
                color: isToday ? 'var(--color-primary)' : 'var(--text)' }}>
                {isToday ? `${t('today')} — ` : ''}{formatDate(date)}
              </span>
              <button onClick={() => onDayClick(date)}
                style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px',
                  border: '1px solid var(--border)', borderRadius: 6, background: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer' }}>
                + {t('add')}
              </button>
            </div>
            {ds.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`,
                borderRadius: 8, marginBottom: 6, background: 'var(--surface)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> {s.start}–{s.end}
                    </span>
                    {s.location && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{s.location}</span>}
                    {s.candidate && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} />{s.candidate}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
