/**
 * Schedule editors — the per-trigger-type option panels (interval/once/times/
 * weekly/monthly/specified/on-demand/advanced) + small helpers. Used by
 * ScheduleSettings.
 */
import { useTranslation } from 'react-i18next'
import { Clock, Calendar, RotateCcw, Zap, Plus, Trash2 } from 'lucide-react'


// Locale-aware Monday-first short weekday names (2024-01-01 = Monday).
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleString(undefined, { weekday: 'short' }))

function pad(n) { return String(n).padStart(2, '0') }

function TimeInput({ value, onChange }) {
  const [h, m] = (value || '08:00').split(':')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <select value={h} onChange={e => onChange(`${e.target.value}:${m}`)}
        style={selectStyle}>
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={pad(i)}>{pad(i)}</option>)}
      </select>
      <span style={{ color: '#9CA3AF', fontWeight: 600 }}>:</span>
      <select value={m} onChange={e => onChange(`${h}:${e.target.value}`)}
        style={selectStyle}>
        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(v =>
          <option key={v} value={v}>{v}</option>
        )}
      </select>
    </div>
  )
}

const selectStyle = {
  padding: '5px 8px', border: '1px solid #E5E7EB', borderRadius: 8,
  fontSize: 13, color: '#111', background: 'white', outline: 'none', cursor: 'pointer',
}

const inputStyle = {
  padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 8,
  fontSize: 13, color: '#111', background: 'white', outline: 'none', width: '100%', boxSizing: 'border-box',
}

export function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{children}</div>
}

export function Section({ children, style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>{children}</div>
}

// ── Schedule types ─────────────────────────────────────────────────────────────

// Schedule types — Icon per type; labels resolved via t('schedule.types.<id>').
export const SCHEDULE_TYPES = [
  { id: 'interval',  Icon: RotateCcw },
  { id: 'once',      Icon: Zap       },
  { id: 'daily',     Icon: Clock     },
  { id: 'weekdays',  Icon: Calendar  },
  { id: 'weekly',    Icon: Calendar  },
  { id: 'monthly',   Icon: Calendar  },
  { id: 'specified', Icon: Calendar  },
  { id: 'ondemand',  Icon: Zap       },
]

// Default state per type
export function defaultSchedule(type) {
  switch (type) {
    case 'interval':  return { type, minutes: 15 }
    case 'once':      return { type, date: '', time: '08:00' }
    case 'daily':     return { type, times: ['08:00'] }
    case 'weekdays':  return { type, times: ['08:00'] }
    case 'weekly':    return { type, days: [0], time: '08:00' }   // 0=Ma
    case 'monthly':   return { type, day: 1, time: '08:00' }
    case 'specified': return { type, dates: [{ date: '', time: '08:00' }] }
    case 'ondemand':  return { type }
    default:          return { type }
  }
}

// ── Renderers per type ────────────────────────────────────────────────────────

export function IntervalEditor({ schedule, onChange }) {
  const { t } = useTranslation('workflows')
  const PRESETS = [5,10,15,30,60,120,240,480]
  return (
    <Section>
      <Label>{t('schedule.intervalLabel')}</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map(m => {
          const active = schedule.minutes === m
          const label  = m < 60 ? t('schedule.minShort', { n: m }) : t('schedule.hourShort', { n: m/60 })
          return (
            <button key={m} type="button" onClick={() => onChange({ ...schedule, minutes: m })}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: active ? 'var(--color-primary-bg)' : '#F9FAFB',
                color:      active ? 'var(--color-primary)'    : '#374151',
                border:     `1px solid ${active ? 'var(--color-primary)' : '#E5E7EB'}`,
              }}>
              {label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{t('schedule.custom')}</span>
        <input type="number" min={1} value={schedule.minutes} onChange={e => onChange({ ...schedule, minutes: Number(e.target.value) })}
          style={{ ...inputStyle, width: 80 }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>{t('schedule.minutes')}</span>
      </div>
    </Section>
  )
}

export function OnceEditor({ schedule, onChange }) {
  const { t } = useTranslation('workflows')
  return (
    <Section>
      <Label>{t('schedule.dateTime')}</Label>
      <div style={{ display: 'flex', gap: 10 }}>
        <input type="date" value={schedule.date} onChange={e => onChange({ ...schedule, date: e.target.value })}
          style={{ ...inputStyle, flex: 1 }} />
        <TimeInput value={schedule.time} onChange={t => onChange({ ...schedule, time: t })} />
      </div>
    </Section>
  )
}

export function TimesListEditor({ schedule, onChange, label }) {
  const { t } = useTranslation('workflows')
  const times = schedule.times || ['08:00']
  const setTimes = (newTimes) => onChange({ ...schedule, times: newTimes })
  return (
    <Section>
      <Label>{label ?? t('schedule.times')}</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {times.map((tm, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TimeInput value={tm} onChange={v => setTimes(times.map((x, j) => j === i ? v : x))} />
            {times.length > 1 && (
              <button type="button" onClick={() => setTimes(times.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', display: 'flex', padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setTimes([...times, '09:00'])}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 500 }}>
          <Plus size={13} /> {t('schedule.addTime')}
        </button>
      </div>
    </Section>
  )
}

export function WeeklyEditor({ schedule, onChange }) {
  const { t } = useTranslation('workflows')
  const days    = schedule.days || [0]
  const toggleDay = (d) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort()
    if (next.length > 0) onChange({ ...schedule, days: next })
  }
  return (
    <Section>
      <Label>{t('schedule.days')}</Label>
      <div style={{ display: 'flex', gap: 6 }}>
        {WEEKDAYS.map((wd, i) => {
          const active = days.includes(i)
          return (
            <button key={i} type="button" onClick={() => toggleDay(i)}
              style={{
                width: 40, height: 36, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: active ? 'var(--color-primary)' : '#F9FAFB',
                color:      active ? 'white'               : '#6B7280',
                border:     `1px solid ${active ? 'var(--color-primary)' : '#E5E7EB'}`,
              }}>
              {wd}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 8 }}>
        <Label>{t('schedule.time')}</Label>
        <TimeInput value={schedule.time} onChange={v => onChange({ ...schedule, time: v })} />
      </div>
    </Section>
  )
}

export function MonthlyEditor({ schedule, onChange }) {
  const { t } = useTranslation('workflows')
  return (
    <Section>
      <Label>{t('schedule.dayOfMonth')}</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <select value={schedule.day} onChange={e => onChange({ ...schedule, day: Number(e.target.value) })}
          style={{ ...selectStyle, width: 80 }}>
          {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{t('schedule.ofEveryMonth')}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <Label>{t('schedule.time')}</Label>
        <TimeInput value={schedule.time} onChange={v => onChange({ ...schedule, time: v })} />
      </div>
    </Section>
  )
}

export function SpecifiedEditor({ schedule, onChange }) {
  const { t } = useTranslation('workflows')
  const dates  = schedule.dates || [{ date: '', time: '08:00' }]
  const setDates = (d) => onChange({ ...schedule, dates: d })
  return (
    <Section>
      <Label>{t('schedule.dates')}</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dates.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="date" value={entry.date} onChange={e => setDates(dates.map((d, j) => j === i ? { ...d, date: e.target.value } : d))}
              style={{ ...inputStyle, flex: 1 }} />
            <TimeInput value={entry.time} onChange={t => setDates(dates.map((d, j) => j === i ? { ...d, time: t } : d))} />
            {dates.length > 1 && (
              <button type="button" onClick={() => setDates(dates.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', display: 'flex', padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setDates([...dates, { date: '', time: '08:00' }])}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 500 }}>
          <Plus size={13} /> {t('schedule.addDate')}
        </button>
      </div>
    </Section>
  )
}

export function OnDemandEditor() {
  const { t } = useTranslation('workflows')
  return (
    <div style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
        {t('schedule.onDemandText')}
      </p>
    </div>
  )
}

// ── Advanced settings ─────────────────────────────────────────────────────────

export function AdvancedSettings({ advanced, onChange }) {
  const { t } = useTranslation('workflows')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Label>{t('schedule.startDate')}</Label>
        <input type="date" value={advanced.startDate || ''} onChange={e => onChange({ ...advanced, startDate: e.target.value })}
          style={inputStyle} />
      </div>
      <div>
        <Label>{t('schedule.endDate')}</Label>
        <input type="date" value={advanced.endDate || ''} onChange={e => onChange({ ...advanced, endDate: e.target.value })}
          style={inputStyle} />
      </div>
      <div>
        <Label>{t('schedule.maxRuns')}</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="number" min={1} max={1000} value={advanced.rateLimit ?? 100}
            onChange={e => onChange({ ...advanced, rateLimit: Number(e.target.value) })}
            style={{ ...inputStyle, width: 100 }} />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{t('schedule.default100')}</span>
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.5 }}>
          {t('schedule.rateLimitHint')}
        </p>
      </div>
    </div>
  )
}

// ── Summary label ─────────────────────────────────────────────────────────────

// Render a schedule config as a short readable string. Pass the i18n `t`
// (workflows namespace); falls back gracefully when omitted.
export function scheduleLabel(schedule, t) {
  if (!t) t = (k) => k
  if (!schedule) return t('schedule.label.notSet')
  const interval = schedule.minutes < 60
    ? t('schedule.minShort', { n: schedule.minutes })
    : t('schedule.hourShort', { n: schedule.minutes / 60 })
  switch (schedule.type) {
    case 'interval':  return t('schedule.label.every', { interval })
    case 'once':      return t('schedule.label.onceOn', { date: schedule.date || '—', time: schedule.time })
    case 'daily':     return t('schedule.label.dailyAt', { times: (schedule.times || []).join(', ') })
    case 'weekdays':  return t('schedule.label.weekdaysAt', { times: (schedule.times || []).join(', ') })
    case 'weekly': {
      const days = (schedule.days || []).map(d => WEEKDAYS[d]).join(', ')
      return t('schedule.label.weeklyOn', { days, time: schedule.time })
    }
    case 'monthly':   return t('schedule.label.monthlyOn', { day: schedule.day, time: schedule.time })
    case 'specified': return t('schedule.label.specifiedCount', { count: schedule.dates?.length ?? 0 })
    case 'ondemand':  return t('schedule.label.onDemand')
    default:          return t('schedule.label.unknown')
  }
}
