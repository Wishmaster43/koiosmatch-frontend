/**
 * DateRelativeFields — the one "date_relative" trigger rijtje, shared verbatim
 * between the workflow builder's trigger panel (ScheduleModal) and the
 * Settings → Automations list row (AutomationsSettings). Two controls:
 *   1. the date field the offset is measured against — a searchable, tenant-fixed
 *      whitelist (CLAUDE.md §3A: every choice list, even a short one, is a
 *      searchable dropdown, never bare text) rendered compactly so it still reads
 *      as the "read-only label" the spec calls for once a workflow already has one;
 *   2. "N days before" — the user always types/sees a POSITIVE number; the caller
 *      is responsible for negating it into `offset_days` on save (§ contract:
 *      trigger_config.offset_days is stored negative, e.g. -28).
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'

// Backend whitelist (trigger_config.date_field) — never invent a third value here
// without a matching backend contract entry.
export const DATE_RELATIVE_FIELDS = [
  { value: 'available_again_date', labelKey: 'dateRelative.fieldAvailableAgain' },
  { value: 'match.end_date',       labelKey: 'dateRelative.fieldMatchEnd' },
] as const

export type DateRelativeFieldValue = typeof DATE_RELATIVE_FIELDS[number]['value']

export function dateRelativeFieldLabel(t: (k: string) => string, value?: string | null) {
  const entry = DATE_RELATIVE_FIELDS.find(f => f.value === value)
  return entry ? t(entry.labelKey) : (value ?? '—')
}

export function DateRelativeFields({ dateField, onDateFieldChange, days, onDaysChange, disabled }: {
  dateField: string
  onDateFieldChange: (v: string) => void
  days: number | string
  onDaysChange: (v: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('workflows')
  const dateFieldLabelId = useId()
  const daysInputId      = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label id={dateFieldLabelId} style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('dateRelative.dateFieldLabel')}
        </label>
        <CreatableSelect value={dateField} onChange={disabled ? () => {} : onDateFieldChange} allowCreate={false}
          options={DATE_RELATIVE_FIELDS.map(f => ({ value: f.value, label: t(f.labelKey) }))}
          aria-labelledby={dateFieldLabelId} style={{ width: '100%' }} />
      </div>
      <div>
        <label htmlFor={daysInputId} style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('dateRelative.daysBeforeLabel')}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id={daysInputId} type="number" min={0} max={999} value={days} disabled={disabled}
            onChange={e => onDaysChange(e.target.value)}
            style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
                     background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
          {/* Positive display unit — the negative offset_days sign is a storage detail only. */}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('dateRelative.daysBeforeSuffix', { count: Number(days) || 0 })}
          </span>
        </div>
      </div>
    </div>
  )
}
