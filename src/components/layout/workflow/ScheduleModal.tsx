/**
 * ScheduleModal — configures a workflow trigger schedule (interval / daily /
 * weekly / monthly / yearly) plus `scheduleLabel`, the human-readable summary
 * shown on the trigger node + button. Extracted from WorkflowCanvasEditor.
 *
 * All visible text runs through i18n (workflows:scheduleModal.*); day/month names
 * come from Intl (locale-aware) so there are no hardcoded NL arrays.
 */
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { X, CalendarDays, Play, Zap, Bell, Webhook } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { unwrapList } from '@/lib/api'
import type { ScheduleConfig } from '@/types/workflow'
import type { AiAgent } from '@/types/ai'
import { WORKFLOW_EVENT_KEYS, eventKeyToI18nKey } from './eventCatalog'

// ── Schedule helpers ──────────────────────────────────────────────────────────

// Localized short day/month names from Intl (week starts Sunday = index 0).
const dayName   = (locale: string, i: number) => new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
const monthName = (locale: string, m: number) => new Date(Date.UTC(2024, m, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })

// Human-readable summary of the trigger/schedule; needs `t` (used on the node too).
export function scheduleLabel(t: TFunction, locale: string, trigger?: string, cfg?: ScheduleConfig | null) {
  if (!trigger || trigger === 'Handmatig') return t('scheduleModal.label.manual')
  if (trigger === 'Direct') return t('scheduleModal.label.instant')
  // Event trigger: show the tenant-facing event name, not the raw dotted key.
  if (trigger === 'Event') {
    const eventKey = String(cfg?.event ?? WORKFLOW_EVENT_KEYS[0])
    return t('scheduleModal.label.event', { event: t(`triggers.events.${eventKeyToI18nKey(eventKey)}`) })
  }
  // Webhook trigger (AI-AGENTS-3): the new agent-coupled flavor names its agent;
  // the legacy generic-webhook flavor (webhook_id, no agent picker here yet)
  // falls back to a plain "Webhook" label instead of misreading as "Gepland".
  if (trigger === 'Webhook') {
    return cfg?.agent ? t('scheduleModal.label.webhookAgent', { agent: cfg.agent }) : t('scheduleModal.label.webhook')
  }
  if (!cfg) return t('scheduleModal.label.scheduled')
  const ty = cfg.schedule_type
  if (ty === 'interval') {
    const unit = cfg.interval_unit === 'hours' ? t('scheduleModal.label.unitHour') : t('scheduleModal.label.unitMin')
    return t('scheduleModal.label.everyN', { n: cfg.interval_value ?? 1, unit })
  }
  const time = cfg.time ?? '08:00'
  if (ty === 'daily')     return t('scheduleModal.label.dailyAt', { time })
  if (ty === 'weekly') {
    const days = (cfg.days_of_week ?? [1]).map(i => dayName(locale, i)).join(', ')
    return t('scheduleModal.label.weeklyAt', { days, time })
  }
  if (ty === 'monthly')   return t('scheduleModal.label.monthlyAt', { day: cfg.day_of_month ?? 1, time })
  if (ty === 'quarterly') return t('scheduleModal.label.quarterlyAt', { time })
  if (ty === 'yearly')    return t('scheduleModal.label.yearlyAt', { month: monthName(locale, (cfg.month ?? 1) - 1), day: cfg.day_of_month ?? 1, time })
  return t('scheduleModal.label.scheduled')
}

// ── Schedule Modal ────────────────────────────────────────────────────────────

export function ScheduleModal({ trigger, scheduleConfig, onSave, onClose }: {
  trigger?: string; scheduleConfig?: ScheduleConfig | null
  onSave: (trigger: string, cfg: ScheduleConfig | null) => void; onClose: () => void
}) {
  const { t, i18n } = useTranslation('workflows')
  const locale = i18n.language
  const [type,     setType]     = useState(
    trigger === 'Handmatig' ? 'manual' : trigger === 'Direct' ? 'instant'
      : trigger === 'Event' ? 'event' : trigger === 'Webhook' ? 'webhook' : 'scheduled',
  )
  const [sType,    setSType]    = useState(scheduleConfig?.schedule_type ?? 'daily')
  // Event trigger: the selected domain-event key (seeded from the catalogue fallback).
  const [eventKey, setEventKey] = useState(String(scheduleConfig?.event ?? WORKFLOW_EVENT_KEYS[0]))
  // Webhook trigger, AI-agent flavor (AI-AGENTS-3): the agent NAME this workflow's
  // own webhook is coupled to (backend matches trigger_config.agent by name).
  const [agentName, setAgentName] = useState(String(scheduleConfig?.agent ?? ''))
  const [agents,        setAgents]        = useState<AiAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
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

  // Load the tenant's AI agents once the webhook tab is opened — each agent has
  // its own inbound webhook (AI-AGENTS-3); no reusable agents hook/context exists
  // yet (checked src/hooks, src/context, 2026-07-20), so this mirrors the same
  // lazy-import fetch idiom as WebhookSelectField/FaqSelectField in fieldControls.tsx.
  useEffect(() => {
    if (type !== 'webhook') return
    let alive = true
    setAgentsLoading(true)
    import('@/lib/api').then(m => m.default.get('/ai/agents'))
      .then(r => { if (alive) setAgents(unwrapList<AiAgent>(r).rows) })
      .catch(() => { if (alive) setAgents([]) })
      .finally(() => { if (alive) setAgentsLoading(false) })
    return () => { alive = false }
  }, [type])

  const handleSave = () => {
    if (type === 'manual')  { onSave('Handmatig', null); return }
    if (type === 'instant') { onSave('Direct', null); return }
    // Event trigger: carries the chosen event key, no schedule fields.
    if (type === 'event')   { onSave('Event', { schedule_type: 'event', event: eventKey }); return }
    // Webhook trigger (AI-agent flavor): carries only the chosen agent's name —
    // the backend couples this workflow to that agent's own inbound webhook.
    if (type === 'webhook') { onSave('Webhook', { schedule_type: 'webhook', agent: agentName }); return }
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
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('scheduleModal.title')} tabIndex={-1}
        style={{ width: 560, background: 'var(--surface)', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color="var(--color-primary)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('scheduleModal.title')}</span>
          </div>
          <button onClick={onClose} aria-label={t('scheduleModal.cancel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Trigger type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8 }}>
            {[
              { id: 'manual',    label: t('scheduleModal.trigger.manual'),    desc: t('scheduleModal.trigger.manualDesc'),    Icon: Play },
              { id: 'instant',   label: t('scheduleModal.trigger.instant'),   desc: t('scheduleModal.trigger.instantDesc'),   Icon: Zap },
              { id: 'scheduled', label: t('scheduleModal.trigger.scheduled'), desc: t('scheduleModal.trigger.scheduledDesc'), Icon: CalendarDays },
              { id: 'event',     label: t('scheduleModal.trigger.event'),     desc: t('scheduleModal.trigger.eventDesc'),     Icon: Bell },
              // AI-AGENTS-3: fifth trigger type — this workflow starts on ONE AI
              // agent's own inbound webhook (config key `agent`, matched by name).
              { id: 'webhook',   label: t('scheduleModal.trigger.webhook'),   desc: t('scheduleModal.trigger.webhookDesc'),   Icon: Webhook },
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

          {/* Event picker — the event catalogue seed (BIRTHDAY-FLOW-2); grows with the BE catalogue */}
          {type === 'event' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{t('scheduleModal.eventLabel')}</label>
              <select value={eventKey} onChange={e => setEventKey(e.target.value)} aria-label={t('scheduleModal.eventLabel')} style={selectStyle}>
                {WORKFLOW_EVENT_KEYS.map(key => (
                  <option key={key} value={key}>{t(`triggers.events.${eventKeyToI18nKey(key)}`)}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('scheduleModal.eventHint')}</p>
            </div>
          )}

          {/* Webhook (AI-agent) picker — one agent, one own webhook (AI-AGENTS-3) */}
          {type === 'webhook' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{t('scheduleModal.agentLabel')}</label>
              {agentsLoading ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('scheduleModal.agentLoading')}</p>
              ) : agents.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {t('scheduleModal.agentEmpty')}
                </p>
              ) : (
                <select value={agentName} onChange={e => setAgentName(e.target.value)} aria-label={t('scheduleModal.agentLabel')} style={selectStyle}>
                  <option value="">{t('scheduleModal.agentSelect')}</option>
                  {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('scheduleModal.agentHint')}</p>
            </div>
          )}

          {/* Schedule type */}
          {type === 'scheduled' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{t('scheduleModal.frequency')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { id: 'interval',  label: t('scheduleModal.freq.interval') },
                    { id: 'daily',     label: t('scheduleModal.freq.daily') },
                    { id: 'weekly',    label: t('scheduleModal.freq.weekly') },
                    { id: 'monthly',   label: t('scheduleModal.freq.monthly') },
                    { id: 'quarterly', label: t('scheduleModal.freq.quarterly') },
                    { id: 'yearly',    label: t('scheduleModal.freq.yearly') },
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{t('scheduleModal.every')}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" min={1} max={999} value={intVal} onChange={e => setIntVal(e.target.value)}
                      aria-label={t('scheduleModal.every')} style={{ ...inputStyle, width: 80 }} />
                    <select value={intUnit} onChange={e => setIntUnit(e.target.value)} aria-label={t('scheduleModal.every')} style={selectStyle}>
                      <option value="minutes">{t('scheduleModal.unit.minutes')}</option>
                      <option value="hours">{t('scheduleModal.unit.hours')}</option>
                    </select>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('scheduleModal.minInterval')}</p>
                </div>
              )}

              {/* Daily — multiple times */}
              {sType === 'daily' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('scheduleModal.times')}</label>
                    <button type="button" onClick={addTime}
                      style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('scheduleModal.addTime')}</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {times.map((tm, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="time" value={tm} onChange={e => updateTime(i, e.target.value)} aria-label={t('scheduleModal.time')} style={{ ...inputStyle, flex: 1 }} />
                        {times.length > 1 && (
                          <button type="button" onClick={() => removeTime(i)} aria-label={t('scheduleModal.cancel')}
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
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{t('scheduleModal.days')}</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 1, 2, 3, 4, 5, 6].map(i => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          style={{
                            width: 38, height: 38, borderRadius: '50%', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: `1.5px solid ${dow.includes(i) ? 'var(--color-primary)' : 'var(--border)'}`,
                            background: dow.includes(i) ? 'var(--color-primary)' : 'var(--surface)',
                            color: dow.includes(i) ? 'white' : 'var(--text)',
                          }}>{dayName(locale, i)}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('scheduleModal.time')}</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Monthly */}
              {sType === 'monthly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('scheduleModal.dayOfMonth')}</label>
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
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('scheduleModal.time')}</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Quarterly */}
              {sType === 'quarterly' && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{t('scheduleModal.quarterlyHint')}</p>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('scheduleModal.time')}</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
                </div>
              )}

              {/* Yearly */}
              {sType === 'yearly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('scheduleModal.month')}</label>
                      <select value={month} onChange={e => setMonth(+e.target.value)} aria-label={t('scheduleModal.month')} style={{ ...selectStyle, width: '100%' }}>
                        {Array.from({ length: 12 }, (_, i) => i).map(i => <option key={i} value={i + 1}>{monthName(locale, i)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('scheduleModal.day')}</label>
                      <input type="number" min={1} max={31} value={dom} onChange={e => setDom(+e.target.value)} aria-label={t('scheduleModal.day')} style={{ ...inputStyle, width: 70 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('scheduleModal.time')}</label>
                      <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('scheduleModal.preview')}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                  {scheduleLabel(t, locale, 'Scheduled', {
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
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('scheduleModal.cancel')}</button>
          <button onClick={handleSave} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>{t('scheduleModal.save')}</button>
        </div>
      </div>
    </div>
  )
}
