/**
 * DateRelativeFields — the one "date_relative" trigger row, used by the
 * workflow builder's trigger panel (ScheduleModal; its former second consumer,
 * the Settings → Automations list row, was retired 2026-08-22). Two controls:
 *   1. the date field the offset is measured against — a searchable, tenant-fixed
 *      whitelist (CLAUDE.md §3A: every choice list, even a short one, is a
 *      searchable dropdown, never bare text) rendered compactly so it still reads
 *      as the "read-only label" the spec calls for once a workflow already has one;
 *   2. "N days before" — the user always types/sees a POSITIVE number; the caller
 *      is responsible for negating it into `offset_days` on save (§ contract:
 *      trigger_config.offset_days is stored negative, e.g. -28).
 * The whitelist + label resolver live in dateRelativeFieldOptions.ts.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { DATE_RELATIVE_FIELDS } from './dateRelativeFieldOptions'
// Shared modal field identity (label + input face) — never re-declared locally.
import { fieldLabel, inputStyle } from './scheduleModalStyles'

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
        <label id={dateFieldLabelId} style={fieldLabel}>
          {t('dateRelative.dateFieldLabel')}
        </label>
        <CreatableSelect value={dateField} onChange={disabled ? () => {} : onDateFieldChange} allowCreate={false}
          options={DATE_RELATIVE_FIELDS.map(f => ({ value: f.value, label: t(f.labelKey) }))}
          aria-labelledby={dateFieldLabelId} style={{ width: '100%' }} />
      </div>
      <div>
        <label htmlFor={daysInputId} style={fieldLabel}>
          {t('dateRelative.daysBeforeLabel')}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id={daysInputId} type="number" min={0} max={999} value={days} disabled={disabled}
            onChange={e => onDaysChange(e.target.value)}
            style={{ ...inputStyle, width: 90 }} />
          {/* Positive display unit — the negative offset_days sign is a storage detail only. */}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('dateRelative.daysBeforeSuffix', { count: Number(days) || 0 })}
          </span>
        </div>
      </div>
    </div>
  )
}
