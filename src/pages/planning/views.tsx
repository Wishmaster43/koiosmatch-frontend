/**
 * Planning calendar views — month / week / day / list renderings of the shift
 * calendar. Presentational: each takes props (current/shifts/today/onDayClick) and
 * renders cells via the shared ShiftPill. Extracted from PlanningPage.
 */
import { useTranslation } from 'react-i18next'
import type { MouseEvent } from 'react'
import { Clock, MapPin, User } from 'lucide-react'
import { isSameDay, WEEKDAYS_MON, formatDate } from './helpers'
import { interactive } from '@/lib/a11y'
import Button from '@/components/ui/Button'
import type { Shift } from '@/types/planning'
import { tintBg, chipInk } from '@/lib/tint'
import { GroupLabel, Caption, SectionTitle } from '@/components/ui/typography'

// onShiftClick (SHIFT-STAFF-1): opens the real staffing drawer for that one
// shift — optional so every view keeps working before it's wired everywhere.
interface ViewProps { current: Date; shifts: Shift[]; today: Date; onDayClick: (date: Date) => void; onShiftClick?: (id: Shift['id']) => void }

// ── Shift pill ────────────────────────────────────────────────────────────────
function ShiftPill({ shift, small, onClick }: { shift: Shift; small?: boolean; onClick?: (e: MouseEvent) => void }) {
  return (
    // Keyboard path (heraudit r4): a clickable pill is button-like (role/tabIndex/
    // Enter+Space); stopPropagation in the keydown mirrors the mouse handler so
    // activating a pill never also fires the day cell behind it (§6).
    <div onClick={onClick}
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick(e as unknown as MouseEvent) }
      } : undefined}
      style={{ background: tintBg(shift.color, true), borderLeft: `3px solid ${shift.color}`,
      borderRadius: 4, padding: small ? '2px 5px' : '3px 7px', marginBottom: 2,
      cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ fontSize: small ? 10 : 11, fontWeight: 600, color: chipInk(shift.color), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {shift.start} {shift.title}
      </div>
      {!small && shift.candidate && (
        <div style={{ fontSize: 10, color: chipInk(shift.color), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shift.candidate}
        </div>
      )}
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────
export function MonthView({ current, shifts, today, onDayClick, onShiftClick }: ViewProps) {
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
          <GroupLabel as="div" style={{ textTransform: 'none', letterSpacing: 0, padding: '8px 0', textAlign: 'center' }}>{d}</GroupLabel>
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
                  // Keyboard path (heraudit r4): the day cell is clickable chrome too.
                  {...interactive(() => onDayClick(date))}
                  style={{ borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                    padding: '6px 6px 4px', background: outside ? 'var(--bg)' : 'var(--surface)',
                    cursor: 'pointer', minHeight: 110, position: 'relative' }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => e.currentTarget.style.background = outside ? 'var(--bg)' : 'var(--surface)' }>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 4, fontSize: 12, fontWeight: isToday ? 700 : 400,
                    // Today-marker reads the trio (same solid look, tenant-adjustable).
                    background: isToday ? 'var(--button-fill)' : 'transparent',
                    color: outside ? 'var(--text-muted)' : isToday ? 'var(--button-ink)' : 'var(--text)',
                  }}>
                    {date.getDate()}
                  </div>
                  {dayShifts.slice(0, 3).map(s => (
                    <ShiftPill key={s.id} shift={s} small onClick={onShiftClick ? e => { e.stopPropagation(); onShiftClick(s.id) } : undefined} />
                  ))}
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
export function WeekView({ current, shifts, today, onDayClick, onShiftClick }: ViewProps) {
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
                <Caption as="div" style={{ marginBottom: 3 }}>{WEEK_LABELS[i]}</Caption>
                <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--button-fill)' : 'transparent',
                  color: isToday ? 'var(--button-ink)' : 'var(--text)', fontSize: 14, fontWeight: isToday ? 700 : 400 }}>
                  {d.getDate()}
                </div>
              </div>
              <div {...interactive(() => onDayClick(d))} style={{ minHeight: 300, cursor: 'pointer', padding: '2px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {shifts.filter(s => isSameDay(s.date, d)).map(s => (
                  <ShiftPill key={s.id} shift={s} onClick={onShiftClick ? e => { e.stopPropagation(); onShiftClick(s.id) } : undefined} />
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
export function DayView({ current, shifts, today, onDayClick, onShiftClick }: ViewProps) {
  const { t } = useTranslation('planning')
  const dayShifts = shifts.filter(s => isSameDay(s.date, current))
  const isToday = isSameDay(current, today)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          {isToday && <span style={{ color: 'var(--color-primary-text)', marginRight: 8 }}>{t('today')} —</span>}
          {formatDate(current)}
        </div>
      </div>

      {dayShifts.length === 0
        ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('noShiftsPlanned')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('addHint')}</div>
            <Button variant="primary" onClick={() => onDayClick(current)}>
              + {t('addShift')}
            </Button>
          </div>
        )
        : (
          <>
            {dayShifts.map(s => (
              <div key={s.id} {...interactive(onShiftClick ? () => onShiftClick(s.id) : undefined)} style={{ display: 'flex', gap: 14, padding: '14px 16px',
                border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`,
                borderRadius: 10, marginBottom: 10, background: 'var(--surface)', cursor: onShiftClick ? 'pointer' : 'default' }}>
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
            {/* HUISSTIJL-1: left hand-styled — the dashed border is a distinct
                "add row" placeholder chrome with no Button variant equivalent.
                Block form: the style attr sits a line into the tag. */}
            {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
            <button onClick={() => onDayClick(current)}
              style={{ width: '100%', padding: '9px', fontSize: 13, border: '1px dashed var(--border)',
                borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
              + {t('addShift')}
            </button>
            {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
          </>
        )
      }
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────
export function ListView({ shifts, today, onDayClick, onShiftClick }: Omit<ViewProps, 'current'>) {
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
                // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                color: isToday ? 'var(--color-primary-text)' : 'var(--text)' }}>
                {isToday ? `${t('today')} — ` : ''}{formatDate(date)}
              </span>
              <Button variant="secondary" size="sm" onClick={() => onDayClick(date)} style={{ marginLeft: 'auto' }}>
                + {t('add')}
              </Button>
            </div>
            {ds.map(s => (
              <div key={s.id} {...interactive(onShiftClick ? () => onShiftClick(s.id) : undefined)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`,
                borderRadius: 8, marginBottom: 6, background: 'var(--surface)', cursor: onShiftClick ? 'pointer' : 'default' }}>
                <div style={{ flex: 1 }}>
                  <SectionTitle as="div">{s.title}</SectionTitle>
                  <div style={{ display: 'flex', gap: 14, marginTop: 3 }}>
                    <Caption as="span" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> {s.start}–{s.end}
                    </Caption>
                    {s.location && <Caption as="span" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{s.location}</Caption>}
                    {s.candidate && <Caption as="span" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} />{s.candidate}</Caption>}
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
