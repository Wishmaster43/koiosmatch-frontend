import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { dayNameIso, monthName, scheduleShortMonthNote } from './scheduleLabel'
import { inputStyle, selectStyle, sectionStyle, sectionLabel, fieldLabel, fieldLabelInline } from './scheduleModalStyles'
import { Caption } from '@/components/ui/typography'
import type { ScheduleForm } from './useScheduleForm'
// Danny 08-08 (§4): the house searchable combobox replaces both bare native
// <select>s below. Kept as CreatableSelect (rather than SelectMenu) here for
// consistency with its sibling controls in this directory (OperatorSelect,
// WebhookAgentSelect) — SelectMenu now closes via the shared useEscapeLayer
// stack and is equally safe inside a trapped dialog.
import CreatableSelect from '@/components/ui/CreatableSelect'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

// Hoisted OUTSIDE the style objects: the accent-fill lint selector walks
// background:'s descendants, so an inline literal there reads as a hand-painted
// accent fill (false positive on tint arguments).
const ACCENT = 'var(--color-primary)'

// ISO weekdays, Monday-first (1..7) — matches the contract's own numbering.
const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/**
 * ScheduleFields — the recurrence editor of the trigger modal: the frequency
 * row (interval · daily · weekly · monthly · quarterly · yearly) plus the detail
 * fields belonging to the chosen frequency.
 *
 * WORKFLOW-SCHEMA-1: every frequency except interval now shares the SAME
 * times-list editor (up to 12 H:i moments) — the backend contract applies
 * `times` uniformly, it no longer singles daily out with an array while the
 * rest carry one `time`. Weekly adds an ISO-weekday (Monday=1..Sunday=7)
 * multi-select above the times; monthly/quarterly add a day-of-month picker;
 * yearly adds both a month picker and a day-of-month picker. Interval keeps its
 * own single "every N minutes" field (5-10080, the contract's own bounds).
 *
 * Its own file because it is the one big, self-contained section of the modal —
 * roughly a third of the markup — and it renders only for the `scheduled`
 * trigger type. It takes the whole form object as ONE prop (state lives in
 * useScheduleForm at modal level, so the user's input survives switching the
 * trigger type back and forth) and reads its own `t`/locale, so nothing is
 * threaded through.
 */
export function ScheduleFields({ form }: { form: ScheduleForm }) {
  const { t, i18n } = useTranslation('workflows')
  const locale = i18n.language
  const { frequency, setFrequency, times, addTime, removeTime, updateTime,
          weekdays, toggleWeekday, monthday, setMonthday, month, setMonth,
          intervalMinutes, setIntervalMinutes } = form
  // Sr-only label for the converted month picker (see the CreatableSelect note above).
  const monthLabelId = useId()
  const shortMonthNote = frequency !== 'interval' ? scheduleShortMonthNote(t, { frequency, monthday } as never) : null

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
            <button key={o.id} type="button" onClick={() => setFrequency(o.id)}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- fixed 6-column choice grid, not the shared SegmentedControl's row/vertical layouts
              style={{
                padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: frequency === o.id ? 600 : 400,
                border: `1.5px solid ${frequency === o.id ? 'var(--color-primary)' : 'var(--border)'}`,
                background: frequency === o.id ? 'var(--color-primary-bg)' : 'var(--surface)',
                // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                color: frequency === o.id ? 'var(--color-primary-text)' : 'var(--text)',
                cursor: 'pointer',
              }}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* Interval — the one frequency with no `times` list, just "every N minutes". */}
      {frequency === 'interval' && (
        <div>
          <label style={{ ...fieldLabel, marginBottom: 8 }}>{t('scheduleModal.every')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min={5} max={10080} value={intervalMinutes} onChange={e => setIntervalMinutes(e.target.value)}
              aria-label={t('scheduleModal.every')} style={{ ...inputStyle, width: 100 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('scheduleModal.unit.minutes')}</span>
          </div>
          <Caption as="p" style={{ marginTop: 6 }}>{t('scheduleModal.minInterval')}</Caption>
        </div>
      )}

      {/* Weekly — ISO weekday multi-select (Monday=1..Sunday=7) above the shared times list. */}
      {frequency === 'weekly' && (
        <div>
          <label style={{ ...fieldLabel, marginBottom: 8 }}>{t('scheduleModal.days')}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {ISO_WEEKDAYS.map(iso => (
              <button key={iso} type="button" onClick={() => toggleWeekday(iso)}
                // CHIP-TINT-1 (Danny 20-08): a selected weekday circle is a
                // choice-chip — active tint + chipInk, never the solid trio.
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- weekday circle picker cell, not a Button
                style={{
                  width: 38, height: 38, borderRadius: '50%', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: weekdays.includes(iso) ? tintBorder(ACCENT, true) : '1px solid var(--border)',
                  background: weekdays.includes(iso) ? tintBg(ACCENT, true) : 'var(--surface)',
                  color: weekdays.includes(iso) ? chipInk(ACCENT) : 'var(--text)',
                }}>{dayNameIso(locale, iso)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly / quarterly / yearly — day-of-month picker (calendar-shaped grid, TRIGGER-POPUP-2). */}
      {(frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {frequency === 'quarterly' && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('scheduleModal.quarterlyHint')}</p>}
          {frequency === 'yearly' && (
            <div>
              <label style={fieldLabel}>{t('scheduleModal.month')}</label>
              <span id={monthLabelId} className="sr-only">{t('scheduleModal.month')}</span>
              <CreatableSelect value={String(month)} onChange={v => setMonth(+v)} aria-labelledby={monthLabelId} allowCreate={false}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(locale, i) }))}
                style={{ ...selectStyle, width: '100%' }} />
            </div>
          )}
          <div>
            <label style={fieldLabel}>{t('scheduleModal.dayOfMonth')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', gap: 6 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <button key={d} type="button" onClick={() => setMonthday(d)}
                  // CHIP-TINT-1 (Danny 20-08, supersedes the 19-08 solid order for
                  // CHIPS): a selected day-cell is a choice-chip — active 16/50
                  // tint + chipInk, never the solid trio ("te krachtig").
                  // eslint-disable-next-line huisstijl/no-restricted-syntax, huisstijlLegacy/no-restricted-syntax -- a calendar day-grid cell (7-col grid, gridTemplateColumns 'repeat(7, 34px)'), not a text/action Button copy
                  style={{ width: 34, height: 34, borderRadius: 8, fontSize: 12, fontWeight: monthday === d ? 700 : 400, cursor: 'pointer',
                    border: monthday === d ? tintBorder(ACCENT, true) : '1px solid var(--border)',
                    background: monthday === d ? tintBg(ACCENT, true) : 'var(--surface)',
                    color: monthday === d ? chipInk(ACCENT) : 'var(--text)',
                  }}>{d}</button>
              ))}
            </div>
            {shortMonthNote && <Caption as="p" style={{ marginTop: 6 }}>{shortMonthNote}</Caption>}
          </div>
        </div>
      )}

      {/* Shared times list — every frequency except interval (up to 12 H:i moments). */}
      {frequency !== 'interval' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={fieldLabelInline}>{t('scheduleModal.times')}</label>
            <Button variant="ghost" onClick={addTime} disabled={times.length >= 12}
              style={{ fontSize: 11, color: times.length >= 12 ? undefined : 'var(--color-primary-text)', fontWeight: 600, padding: 0 }}>
              {t('scheduleModal.addTime')}
            </Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {times.map((tm, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="time" value={tm} onChange={e => updateTime(i, e.target.value)} aria-label={t('scheduleModal.time')} style={{ ...inputStyle, flex: 1 }} />
                {times.length > 1 && (
                  <Button variant="ghost" iconOnly onClick={() => removeTime(i)} aria-label={t('scheduleModal.cancel')}
                    style={{ color: 'var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}>
                    <X size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
