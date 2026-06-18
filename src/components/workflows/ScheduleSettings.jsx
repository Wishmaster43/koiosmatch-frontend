/**
 * ScheduleSettings — UI for configuring WHEN a workflow runs.
 *
 * Lets the user pick a trigger type (manual / interval / daily / weekly /
 * monthly / cron-like) and the matching options (times, weekdays, days of
 * month). Produces the schedule config object consumed by the editor.
 * Also exports scheduleLabel() to render that config as a short readable string.
 *
 * Main blocks below:
 *   - WEEKDAYS / MONTHS / pad → small date constants + helpers
 *   - TimeInput               → hour:minute picker built from two selects
 *   - (further down)          → the trigger-type sections + the exported panel
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock, Calendar, RotateCcw, Zap, ChevronDown, Plus, Trash2 } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{children}</div>
}

function Section({ children, style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>{children}</div>
}

// ── Schedule types ─────────────────────────────────────────────────────────────

// Schedule types — Icon per type; labels resolved via t('schedule.types.<id>').
const SCHEDULE_TYPES = [
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
function defaultSchedule(type) {
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

function IntervalEditor({ schedule, onChange }) {
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

function OnceEditor({ schedule, onChange }) {
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

function TimesListEditor({ schedule, onChange, label }) {
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

function WeeklyEditor({ schedule, onChange }) {
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

function MonthlyEditor({ schedule, onChange }) {
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

function SpecifiedEditor({ schedule, onChange }) {
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

function OnDemandEditor() {
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

function AdvancedSettings({ advanced, onChange }) {
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

// ── Main component ────────────────────────────────────────────────────────────

export default function ScheduleSettings({ value, onChange, onClose }) {
  const { t } = useTranslation('workflows')
  const initial = value || defaultSchedule('interval')
  const [schedule,  setSchedule]  = useState(initial)
  const [advanced,  setAdvanced]  = useState(value?.advanced || {})
  const [showAdv,   setShowAdv]   = useState(false)

  const handleTypeChange = (type) => {
    setSchedule(defaultSchedule(type))
  }

  const handleSave = () => {
    onChange({ ...schedule, advanced })
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />

      <div style={{
        position: 'fixed', zIndex: 56,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, maxHeight: '90vh',
        background: 'white', borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{t('schedule.header')}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{scheduleLabel(schedule, t)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Type picker */}
          <Section>
            <Label>{t('schedule.run')}</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SCHEDULE_TYPES.map(({ id, Icon }) => {
                const active = schedule.type === id
                return (
                  <button key={id} type="button" onClick={() => handleTypeChange(id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8, textAlign: 'left',
                      background: active ? 'var(--color-primary-bg)' : 'none',
                      border: `1px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none' }}>
                    <Icon size={15} color={active ? 'var(--color-primary)' : '#9CA3AF'} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--color-primary)' : '#374151' }}>
                      {t(`schedule.types.${id}`)}
                    </span>
                    {active && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Type-specific editor */}
          {schedule.type !== 'ondemand' && (
            <div style={{ padding: 16, background: '#FAFAFA', borderRadius: 12, border: '1px solid #F3F4F6' }}>
              {schedule.type === 'interval'  && <IntervalEditor  schedule={schedule} onChange={setSchedule} />}
              {schedule.type === 'once'      && <OnceEditor      schedule={schedule} onChange={setSchedule} />}
              {schedule.type === 'daily'     && <TimesListEditor schedule={schedule} onChange={setSchedule} label={t('schedule.times')} />}
              {schedule.type === 'weekdays'  && <TimesListEditor schedule={schedule} onChange={setSchedule} label={t('schedule.timesWeekdays')} />}
              {schedule.type === 'weekly'    && <WeeklyEditor    schedule={schedule} onChange={setSchedule} />}
              {schedule.type === 'monthly'   && <MonthlyEditor   schedule={schedule} onChange={setSchedule} />}
              {schedule.type === 'specified' && <SpecifiedEditor schedule={schedule} onChange={setSchedule} />}
            </div>
          )}
          {schedule.type === 'ondemand' && <OnDemandEditor />}

          {/* Advanced toggle */}
          {schedule.type !== 'ondemand' && (
            <div>
              <button type="button" onClick={() => setShowAdv(s => !s)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <ChevronDown size={14} style={{ transform: showAdv ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                {t('schedule.advanced')}
              </button>
              {showAdv && (
                <div style={{ marginTop: 14, padding: 16, background: '#FAFAFA', borderRadius: 12, border: '1px solid #F3F4F6' }}>
                  <AdvancedSettings advanced={advanced} onChange={setAdvanced} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #F3F4F6', flexShrink: 0, background: '#FAFAFA' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, color: '#6B7280', background: 'white', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
            {t('common:cancel')}
          </button>
          <button onClick={handleSave}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'white', background: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}>
            {t('common:save')}
          </button>
        </div>
      </div>
    </>
  )
}
