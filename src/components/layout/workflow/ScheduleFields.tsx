/**
 * ScheduleFields — the recurrence editor of the trigger modal: the frequency
 * row (interval · daily · weekly · monthly · quarterly · yearly) plus the detail
 * fields belonging to the chosen frequency.
 *
 * Its own file because it is the one big, self-contained section of the modal —
 * roughly a third of the markup — and it renders only for the `scheduled`
 * trigger type. It takes the whole form object as ONE prop (state lives in
 * useScheduleForm at modal level, so the user's input survives switching the
 * trigger type back and forth) and reads its own `t`/locale, so nothing is
 * threaded through.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { dayName, monthName } from './scheduleLabel'
import { inputStyle, selectStyle, sectionStyle, sectionLabel, fieldLabel, fieldLabelInline } from './scheduleModalStyles'
import type { ScheduleForm } from './useScheduleForm'
// Danny 08-08 (§4): the house searchable combobox replaces both bare native
// <select>s below. Also the SAFER pick here specifically: this modal is
// wrapped in useFocusTrap (via FloatingPanel), and EventCombobox's own doc
// comment (this same directory) proved SelectMenu's document-level Escape
// listener shares the plain <select>'s latent flaw in a trapped dialog —
// only CreatableSelect's portalled popover truly survives it.
import CreatableSelect from '@/components/ui/CreatableSelect'

export function ScheduleFields({ form }: { form: ScheduleForm }) {
  const { t, i18n } = useTranslation('workflows')
  const locale = i18n.language
  const { sType, setSType, intVal, setIntVal, intUnit, setIntUnit, time, setTime,
          times, addTime, removeTime, updateTime, dow, toggleDay, dom, setDom, month, setMonth } = form
  // Sr-only labels for the two converted pickers (see the CreatableSelect note above).
  const intUnitLabelId = useId()
  const monthLabelId   = useId()

  return (
    <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={sectionLabel}>{t('scheduleModal.frequency')}</label>
        {/* One row of six in the wider modal (TRIGGER-POPUP-2). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
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
                padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: sType === o.id ? 600 : 400,
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
          <label style={{ ...fieldLabel, marginBottom: 8 }}>{t('scheduleModal.every')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min={1} max={999} value={intVal} onChange={e => setIntVal(e.target.value)}
              aria-label={t('scheduleModal.every')} style={{ ...inputStyle, width: 80 }} />
            <span id={intUnitLabelId} className="sr-only">{t('scheduleModal.every')}</span>
            <div style={{ width: 150 }}>
              {/* selectStyle carries width:'auto' (inline row default) — override it
                  here so the trigger fills its 150px slot instead of leaving dead
                  space, same as the month picker below. */}
              <CreatableSelect value={intUnit} onChange={v => setIntUnit(v)} aria-labelledby={intUnitLabelId} allowCreate={false}
                options={[
                  { value: 'minutes', label: t('scheduleModal.unit.minutes') },
                  { value: 'hours', label: t('scheduleModal.unit.hours') },
                ]}
                style={{ ...selectStyle, width: '100%' }} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('scheduleModal.minInterval')}</p>
        </div>
      )}

      {/* Daily — multiple times */}
      {sType === 'daily' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={fieldLabelInline}>{t('scheduleModal.times')}</label>
            <button type="button" onClick={addTime}
              style={{ fontSize: 11, color: 'var(--color-primary-text)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('scheduleModal.addTime')}</button>
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
            <label style={{ ...fieldLabel, marginBottom: 8 }}>{t('scheduleModal.days')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  style={{
                    width: 38, height: 38, borderRadius: '50%', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${dow.includes(i) ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: dow.includes(i) ? 'var(--color-primary)' : 'var(--surface)',
                    color: dow.includes(i) ? 'var(--color-on-accent)' : 'var(--text)',
                  }}>{dayName(locale, i)}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={fieldLabel}>{t('scheduleModal.time')}</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Monthly */}
      {sType === 'monthly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={fieldLabel}>{t('scheduleModal.dayOfMonth')}</label>
            {/* Calendar-shaped 7-column day grid (TRIGGER-POPUP-2). */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', gap: 6 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <button key={d} type="button" onClick={() => setDom(d)}
                  style={{
                    width: 34, height: 34, borderRadius: 8, fontSize: 12, fontWeight: dom === d ? 700 : 400, cursor: 'pointer',
                    border: `1.5px solid ${dom === d ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: dom === d ? 'var(--color-primary)' : 'var(--surface)',
                    color: dom === d ? 'var(--color-on-accent)' : 'var(--text)',
                  }}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={fieldLabel}>{t('scheduleModal.time')}</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Quarterly */}
      {sType === 'quarterly' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{t('scheduleModal.quarterlyHint')}</p>
          <label style={fieldLabel}>{t('scheduleModal.time')}</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
        </div>
      )}

      {/* Yearly */}
      {sType === 'yearly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>{t('scheduleModal.month')}</label>
              <span id={monthLabelId} className="sr-only">{t('scheduleModal.month')}</span>
              <CreatableSelect value={String(month)} onChange={v => setMonth(+v)} aria-labelledby={monthLabelId} allowCreate={false}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(locale, i) }))}
                style={{ ...selectStyle, width: '100%' }} />
            </div>
            <div>
              <label style={fieldLabel}>{t('scheduleModal.day')}</label>
              <input type="number" min={1} max={31} value={dom} onChange={e => setDom(+e.target.value)} aria-label={t('scheduleModal.day')} style={{ ...inputStyle, width: 70 }} />
            </div>
            <div>
              <label style={fieldLabel}>{t('scheduleModal.time')}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label={t('scheduleModal.time')} style={inputStyle} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
