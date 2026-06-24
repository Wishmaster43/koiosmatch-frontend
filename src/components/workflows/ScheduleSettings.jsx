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
import { X, Clock, ChevronDown } from 'lucide-react'
import { IntervalEditor, OnceEditor, TimesListEditor, WeeklyEditor, MonthlyEditor, SpecifiedEditor, OnDemandEditor, AdvancedSettings, Label, Section, SCHEDULE_TYPES, defaultSchedule, scheduleLabel } from './scheduleEditors'

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
