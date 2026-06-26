import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, X, Check } from 'lucide-react'
import { AGENDA_SHIFTS } from '../data/mocks'
import { sectionBlock } from './constants'
import { useLocale } from '@/lib/datetime'
import type { AgendaShift } from './planningTypes'

const SHIFTS = AGENDA_SHIFTS as unknown as AgendaShift[]

function ShiftDetail({ s, onClose }: { s: AgendaShift; onClose: () => void }) {
  const { t } = useTranslation('candidates')
  const [fav, setFav] = useState(s.favorite ?? false)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: s.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.client}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.function}</div>
        </div>
        <button onClick={() => setFav(f => !f)} title={fav ? t('planning.removeFavorite') : t('planning.markFavorite')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: fav ? 'var(--color-danger)' : 'var(--text-muted)', display: 'flex' }}>
          <Heart size={15} fill={fav ? 'var(--color-danger)' : 'none'} />
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
      {([
        [t('planning.time'),         `${s.start ?? '?'}:00 – ${s.end ?? '?'}:00`],
        [t('planning.location'),     s.location ?? '-'],
        [t('planning.address'),      s.address   ?? '-'],
        [t('planning.workedBefore'), s.workedBefore > 0 ? t('planning.workedBeforeYes', { count: s.workedBefore, client: s.client }) : t('planning.workedBeforeNo', { client: s.client })],
      ] as [string, string][]).map(([l, v]) => (
        <div key={l} style={{ display: 'flex', padding: '8px 14px', borderBottom: '1px solid var(--border)', gap: 12, background: 'var(--surface)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{l}</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{v}</span>
        </div>
      ))}
      {s.workedBefore > 0 && (
        <div style={{ padding: '8px 14px', background: 'var(--color-success-bg)', borderTop: '1px solid var(--color-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={12} color="var(--color-success)" />
          <span style={{ fontSize: 11, color: '#15803D', fontWeight: 500 }}>{t('planning.knownAtClient')}</span>
        </div>
      )}
    </div>
  )
}

export default function AvailabilityCalendar() {
  const { t } = useTranslation('candidates')
  const locale = useLocale()
  const [view,     setView]     = useState('month')
  const [base,     setBase]     = useState(new Date(2026, 5, 16))
  const [selected, setSelected] = useState<AgendaShift | null>(null)

  // Day/month names follow the active locale (2024-01-01 was a Monday → Monday-first).
  const DAY_NAMES    = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { weekday: 'short' }); return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))) }, [locale])
  const DAYS_FULL  = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { weekday: 'long' });  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))) }, [locale])
  const MONTH_NAMES  = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { month: 'long' });    return Array.from({ length: 12 }, (_, i) => f.format(new Date(2024, i, 1))) }, [locale])
  const HOURS     = [7,8,9,10,11,12,13,14,15,16,17,18]

  const addDays    = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const addMonths_ = (d: Date, n: number) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r }
  const fmtD       = (d: Date)    => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const getMon     = (d: Date)    => { const r = new Date(d); const dw = r.getDay(); r.setDate(r.getDate() - (dw === 0 ? 6 : dw - 1)); r.setHours(0,0,0,0); return r }
  const getDOW     = (d: Date)    => { const d0 = d.getDay(); return d0 === 0 ? 6 : d0 - 1 }

  const shiftsForDate = (d: Date): AgendaShift[] => SHIFTS.filter(s => s.date === fmtD(d))

  const nav = (n: number) => {
    setSelected(null)
    if (view === 'day')   setBase(b => addDays(b, n))
    if (view === 'week')  setBase(b => addDays(b, n * 7))
    if (view === 'month') setBase(b => addMonths_(b, n))
  }

  const navLabel = () => {
    if (view === 'month') return `${MONTH_NAMES[base.getMonth()].charAt(0).toUpperCase() + MONTH_NAMES[base.getMonth()].slice(1)} ${base.getFullYear()}`
    if (view === 'week')  {
      const mon = getMon(base); const sun = addDays(mon, 6)
      if (mon.getMonth() === sun.getMonth())
        return `${mon.getDate()} – ${sun.getDate()} ${MONTH_NAMES[mon.getMonth()]} ${mon.getFullYear()}`
      return `${mon.getDate()} ${MONTH_NAMES[mon.getMonth()].slice(0,3)} – ${sun.getDate()} ${MONTH_NAMES[sun.getMonth()].slice(0,3)} ${sun.getFullYear()}`
    }
    return `${base.getDate()} ${MONTH_NAMES[base.getMonth()]} ${base.getFullYear()}`
  }

  const renderWeek = () => {
    const mon  = getMon(base)
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
    const today = new Date()
    const isToday = (d: Date) => d.toDateString() === today.toDateString()
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          <div />
          {days.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '6px 2px', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{DAY_NAMES[i]}</div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', margin: '2px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isToday(d) ? 'var(--color-primary)' : 'transparent',
                fontSize: 13, fontWeight: 700, color: isToday(d) ? 'white' : i >= 5 ? 'var(--text-muted)' : 'var(--text)' }}>
                {d.getDate()}
              </div>
            </div>
          ))}
        </div>
        {HOURS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: 32 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '6px 6px 0', textAlign: 'right', background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>{h}:00</div>
            {days.map((d, i) => {
              const ds = shiftsForDate(d).filter(s => h >= s.start && h < s.end)
              return (
                <div key={i} style={{ display: 'flex', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', background: i >= 5 ? 'var(--hover-bg)' : 'transparent' }}>
                  {ds.map((s, j) => (
                    <div key={j} onClick={() => setSelected(s)}
                      style={{ flex: 1, minWidth: 0, boxSizing: 'border-box',
                        background: selected === s ? s.color + '40' : s.color + '22',
                        borderLeft: `3px solid ${s.color}`,
                        // Only the start hour shows the name + top border; following hours join seamlessly.
                        borderTop: h === s.start ? `1px solid ${s.color}55` : 'none',
                        padding: h === s.start ? '2px 4px' : 0, fontSize: 9, color: s.color,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: 1.4, cursor: 'pointer' }}>
                      {h === s.start ? s.client : ''}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderMonth = () => {
    const year = base.getFullYear(), month = base.getMonth()
    const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0)
    const startDow = getDOW(firstDay)
    const cells: (number | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (number | null)[][] = []; for (let r = 0; r < cells.length / 7; r++) rows.push(cells.slice(r*7, r*7+7))
    const today = new Date()
    const isToday = (d: number | null) => d != null && year === today.getFullYear() && month === today.getMonth() && d === today.getDate()

    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          {DAY_NAMES.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', padding: '7px 4px', fontSize: 10, fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>{d}</div>
          ))}
        </div>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {row.map((day, ci) => {
              const d = day ? new Date(year, month, day) : null
              const ds = d ? shiftsForDate(d) : []
              const tod = isToday(day)
              return (
                <div key={ci} style={{ height: 92, padding: '4px', overflow: 'hidden', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', borderLeft: ci > 0 ? '1px solid var(--border)' : 'none',
                  background: ci >= 5 ? 'var(--hover-bg)' : 'var(--surface)' }}>
                  {day && (
                    <>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: tod ? 'var(--color-primary)' : 'transparent', marginBottom: 2, flexShrink: 0,
                        fontSize: 11, fontWeight: tod ? 700 : 400, color: tod ? 'white' : ci >= 5 ? 'var(--text-muted)' : 'var(--text)' }}>
                        {day}
                      </div>
                      {ds.slice(0, 2).map((s, j) => (
                        <div key={j} onClick={() => setSelected(selected === s ? null : s)}
                          style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, marginBottom: 2, cursor: 'pointer', flexShrink: 0,
                            background: selected === s ? s.color + '40' : s.color + '18',
                            color: s.color, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            borderLeft: `3px solid ${s.color}`, outline: selected === s ? `2px solid ${s.color}` : 'none' }}>
                          {s.start}:00–{s.end}:00 {s.client}
                        </div>
                      ))}
                      {ds.length > 2 && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', paddingLeft: 4, fontWeight: 600 }}>+{ds.length - 2}</div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderDay = () => {
    const ds = shiftsForDate(base)
    const today = new Date(); const isToday = base.toDateString() === today.toDateString()
    const dow = getDOW(base)
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {DAYS_FULL[dow]} {base.getDate()} {MONTH_NAMES[base.getMonth()]}
          </span>
          {isToday && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: 'var(--color-primary)', color: 'white', fontWeight: 600 }}>{t('planning.today')}</span>}
          {ds.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{t('planning.noShifts')}</span>}
        </div>
        {HOURS.map((h, hi) => {
          const starters   = ds.filter(s => s.start === h)
          const continuers = ds.filter(s => h > s.start && h < s.end)
          return (
            <div key={h} style={{ display: 'grid', gridTemplateColumns: '50px 1fr', borderBottom: hi < HOURS.length - 1 ? '1px solid var(--border)' : 'none', minHeight: 40 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 8px 0', textAlign: 'right', borderRight: '1px solid var(--border)', background: 'var(--bg)' }}>{h}:00</div>
              <div style={{ position: 'relative', padding: starters.length ? '4px 10px' : 0 }}>
                {starters.map((s, j) => (
                  <div key={j} onClick={() => setSelected(selected === s ? null : s)}
                    style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 3, cursor: 'pointer',
                      background: selected === s ? s.color + '30' : s.color + '18',
                      borderLeft: `3px solid ${s.color}`, outline: selected === s ? `2px solid ${s.color}` : 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.client}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.function} · {s.start}:00–{s.end}:00</div>
                  </div>
                ))}
                {continuers.map((s, j) => (
                  <div key={j} onClick={() => setSelected(selected === s ? null : s)}
                    style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                      background: selected === s ? s.color : s.color + '80', cursor: 'pointer', borderRadius: 0 }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const vBtn = (id: string): CSSProperties => ({
    padding: '4px 10px', fontSize: 11, fontWeight: view === id ? 600 : 400, borderRadius: 6, cursor: 'pointer',
    border: '1px solid ' + (view === id ? 'var(--color-primary)' : 'var(--border)'),
    background: view === id ? 'var(--color-primary)' : 'none',
    color: view === id ? 'white' : 'var(--text-muted)',
  })

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('planning.availability')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['day', t('planning.day')],['week', t('planning.week')],['month', t('planning.month')]] as [string, string][]).map(([id, lbl]) => (
            <button key={id} style={vBtn(id)} onClick={() => { setView(id); setSelected(null) }}>{lbl}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => nav(-1)} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, textAlign: 'center' }}>{navLabel()}</span>
        <button onClick={() => nav(1)}  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>›</button>
      </div>
      {view === 'week'  && renderWeek()}
      {view === 'month' && renderMonth()}
      {view === 'day'   && renderDay()}
      {selected && <ShiftDetail key={selected.date + selected.client} s={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
