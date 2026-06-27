/**
 * ScheduleModal — configures a workflow trigger schedule (interval / daily /
 * weekly / monthly / yearly) plus `scheduleLabel`, the human-readable summary
 * shown on the trigger node + button. Extracted from WorkflowCanvasEditor.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { X, CalendarDays, Play, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ScheduleConfig } from '../../../types/workflow'

// ── Schedule helpers ──────────────────────────────────────────────────────────

const DAYS_NL  = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']

export function scheduleLabel(trigger?: string, cfg?: ScheduleConfig | null) {
  if (!trigger || trigger === 'Handmatig') return 'Handmatig'
  if (trigger === 'Direct') return 'Direct'
  if (!cfg) return 'Gepland'
  const t = cfg.schedule_type
  if (t === 'interval') {
    const u = cfg.interval_unit === 'hours' ? 'uur' : 'min'
    return `Elke ${cfg.interval_value ?? 1} ${u}`
  }
  const time = cfg.time ?? '08:00'
  if (t === 'daily')   return `Dagelijks ${time}`
  if (t === 'weekly') {
    const d = (cfg.days_of_week ?? [1]).map(i => DAYS_NL[i]).join(', ')
    return `${d} ${time}`
  }
  if (t === 'monthly') return `Dag ${cfg.day_of_month ?? 1} v/d maand ${time}`
  if (t === 'quarterly') return `Elk kwartaal ${time}`
  if (t === 'yearly')  return `Jaarlijks ${MONTHS_NL[(cfg.month ?? 1) - 1]} ${cfg.day_of_month ?? 1} ${time}`
  return 'Gepland'
}

// ── Schedule Modal ────────────────────────────────────────────────────────────

export function ScheduleModal({ trigger, scheduleConfig, onSave, onClose }: {
  trigger?: string; scheduleConfig?: ScheduleConfig | null
  onSave: (trigger: string, cfg: ScheduleConfig | null) => void; onClose: () => void
}) {
  const [type,     setType]     = useState(trigger === 'Handmatig' ? 'manual' : trigger === 'Direct' ? 'instant' : 'scheduled')
  const [sType,    setSType]    = useState(scheduleConfig?.schedule_type ?? 'daily')
  const [intVal,   setIntVal]   = useState<number | string>(scheduleConfig?.interval_value ?? 15)
  const [intUnit,  setIntUnit]  = useState(scheduleConfig?.interval_unit  ?? 'minutes')
  const [time,     setTime]     = useState(scheduleConfig?.time ?? '08:00')
  const [times,    setTimes]    = useState<string[]>(scheduleConfig?.times ?? ['08:00'])
  const [dow,      setDow]      = useState<number[]>(scheduleConfig?.days_of_week ?? [1, 2, 3, 4, 5])
  const [dom,      setDom]      = useState(scheduleConfig?.day_of_month ?? 1)
  const [month,    setMonth]    = useState(scheduleConfig?.month ?? 1)
  const toggleDay = (d: number) => setDow(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d].sort((a,b)=>a-b))

  const addTime    = () => setTimes(ts => [...ts, '08:00'])
  const removeTime = (i: number)  => setTimes(ts => ts.filter((_, j) => j !== i))
  const updateTime = (i: number, v: string) => setTimes(ts => ts.map((t, j) => j === i ? v : t))

  const handleSave = () => {
    if (type === 'manual')  { onSave('Handmatig', null); return }
    if (type === 'instant') { onSave('Direct', null); return }
    const cfg: ScheduleConfig = { schedule_type: sType }
    if (sType === 'interval') { cfg.interval_value = +intVal; cfg.interval_unit = intUnit }
    else if (sType === 'daily')     { cfg.times = times }
    else if (sType === 'weekly')    { cfg.days_of_week = dow; cfg.time = time }
    else if (sType === 'monthly')   { cfg.day_of_month = +dom; cfg.time = time }
    else if (sType === 'quarterly') { cfg.time = time }
    else if (sType === 'yearly')    { cfg.day_of_month = +dom; cfg.month = +month; cfg.time = time }
    onSave('Scheduled', cfg)
  }

  const inputStyle: CSSProperties = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }
  const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div style={{ width: 480, background: 'var(--surface)', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color="var(--color-primary)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Planning instellen</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Trigger type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { id: 'manual',    label: 'Handmatig', desc: 'Starten via de knop',          Icon: Play },
              { id: 'instant',   label: 'Direct',    desc: 'Zodra data binnenkomt',         Icon: Zap },
              { id: 'scheduled', label: 'Gepland',   desc: 'Automatisch op een schema',     Icon: CalendarDays },
            ].map(({ id, label, desc, Icon: Ic }: { id: string; label: string; desc: string; Icon: LucideIcon }) => (
              <button key={id} type="button" onClick={() => setType(id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${type === id ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: type === id ? 'var(--color-primary-bg)' : 'var(--surface)',
                }}>
                <Ic size={20} color={type === id ? 'var(--color-primary)' : 'var(--text-muted)'} />
                <span style={{ fontSize: 13, fontWeight: 600, color: type === id ? 'var(--color-primary)' : 'var(--text)' }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{desc}</span>
              </button>
            ))}
          </div>

          {/* Schedule type */}
          {type === 'scheduled' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Frequentie</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { id: 'interval',  label: 'Interval' },
                    { id: 'daily',     label: 'Dagelijks' },
                    { id: 'weekly',    label: 'Wekelijks' },
                    { id: 'monthly',   label: 'Maandelijks' },
                    { id: 'quarterly', label: 'Kwartaal' },
                    { id: 'yearly',    label: 'Jaarlijks' },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => setSType(o.id)}
                      style={{
                        padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: sType === o.id ? 600 : 400,
                        border: `1.5px solid ${sType === o.id ? 'var(--color-primary)' : 'var(--border)'}`,
                        background: sType === o.id ? 'var(--color-primary-bg)' : 'var(--surface)',
                        color: sType === o.id ? 'var(--color-primary)' : 'var(--text)',
                        cursor: 'pointer',
                      }}>{o.label}</button>
                  ))}
                </div>
              </div>

              {/* Interval */}
              {sType === 'interval' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Elke</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" min={1} max={999} value={intVal} onChange={e => setIntVal(e.target.value)}
                      style={{ ...inputStyle, width: 80 }} />
                    <select value={intUnit} onChange={e => setIntUnit(e.target.value)} style={selectStyle}>
                      <option value="minutes">Minuten</option>
                      <option value="hours">Uren</option>
                    </select>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Min. interval: 1 minuut</p>
                </div>
              )}

              {/* Daily — multiple times */}
              {sType === 'daily' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tijdstippen</label>
                    <button type="button" onClick={addTime}
                      style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Tijdstip toevoegen</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {times.map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="time" value={t} onChange={e => updateTime(i, e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        {times.length > 1 && (
                          <button type="button" onClick={() => removeTime(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', display: 'flex', padding: 4 }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly */}
              {sType === 'weekly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Dagen</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {DAYS_NL.map((d, i) => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          style={{
                            width: 38, height: 38, borderRadius: '50%', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: `1.5px solid ${dow.includes(i) ? 'var(--color-primary)' : 'var(--border)'}`,
                            background: dow.includes(i) ? 'var(--color-primary)' : 'var(--surface)',
                            color: dow.includes(i) ? 'white' : 'var(--text)',
                          }}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Monthly */}
              {sType === 'monthly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Dag van de maand</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <button key={d} type="button" onClick={() => setDom(d)}
                          style={{
                            width: 34, height: 34, borderRadius: 8, fontSize: 12, fontWeight: dom === d ? 700 : 400, cursor: 'pointer',
                            border: `1.5px solid ${dom === d ? 'var(--color-primary)' : 'var(--border)'}`,
                            background: dom === d ? 'var(--color-primary)' : 'var(--surface)',
                            color: dom === d ? 'white' : 'var(--text)',
                          }}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Quarterly */}
              {sType === 'quarterly' && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Wordt uitgevoerd op de eerste dag van elk kwartaal (jan, apr, jul, okt).</p>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                </div>
              )}

              {/* Yearly */}
              {sType === 'yearly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Maand</label>
                      <select value={month} onChange={e => setMonth(+e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                        {MONTHS_NL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Dag</label>
                      <input type="number" min={1} max={31} value={dom} onChange={e => setDom(+e.target.value)} style={{ ...inputStyle, width: 70 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                      <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Voorbeeld</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                  {scheduleLabel('Scheduled', {
                    schedule_type: sType,
                    interval_value: +intVal, interval_unit: intUnit,
                    time, times, days_of_week: dow, day_of_month: dom, month,
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>Annuleren</button>
          <button onClick={handleSave} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Opslaan</button>
        </div>
      </div>
    </div>
  )
}
