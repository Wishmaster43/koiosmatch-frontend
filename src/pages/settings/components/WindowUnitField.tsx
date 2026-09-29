/**
 * WindowUnitField — the ONE reusable unit picker for a tenant-setting time window
 * (days/workdays/weeks/months) that persists outside a SchemaSection form (a screen
 * that reads/writes its amount through NumberSettingField, not the catalogue). Generalised
 * from the old KoiosAdviceSettings-local `VacancyAdviceStaleUnitField` (SETTINGS-UNIT-PAIRS-1)
 * so a second window on the same screen (application-stage staleness) reuses it instead of
 * a fourth hand copy. Persists independently, same as NumberSettingField's own amount field.
 */
import { useTranslation } from 'react-i18next'
import { SelectField } from './SettingsKit'
import { WINDOW_UNIT_OPTIONS } from './windowUnitOptions'
import { useAllSettings, useSettingsLoaded, saveSettingsKeys, invalidateAllSettingsCache, getStringSetting } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'

export interface WindowUnitFieldProps {
  settingsKey: string
  ariaLabel: string
  saveFailedMessage: string
  defaultUnit?: string
}

export default function WindowUnitField({ settingsKey, ariaLabel, saveFailedMessage, defaultUnit = 'days' }: WindowUnitFieldProps) {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const loaded = useSettingsLoaded()
  const value = getStringSetting(settings, settingsKey, defaultUnit) ?? defaultUnit
  const options = WINDOW_UNIT_OPTIONS.map(o => ({ value: o.value, label: t(o.label) }))
  const onChange = async (v: string) => {
    if (!loaded) return
    try {
      await saveSettingsKeys({ [settingsKey]: v })
      invalidateAllSettingsCache()
    } catch (err) {
      // ADVICE-UNIT-FEEDBACK-1: a failed write is SAID, never swallowed — the field
      // re-reads `value` from the settings cache (last-confirmed value).
      notifyError(extractApiError(err, saveFailedMessage))
    }
  }
  return (
    // DROPDOWN-CLEAR-1: this unit pairs with a required amount and must never persist empty.
    <SelectField value={value} onChange={onChange} options={options} ariaLabel={ariaLabel} disabled={!loaded} clearable={false} />
  )
}
