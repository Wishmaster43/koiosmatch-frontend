/**
 * readWindowSetting — a tenant day-window as {amount, unit}: `<key>` through
 * getNumberSetting (the ONE numeric cast idiom) and `<key>_unit` tolerantly
 * (missing or unknown → the default unit, days for the Koios advice windows).
 * Its own module on purpose (WINDOW-UNIT-READERS-1, measured 30-09): the pure
 * engines import `@/lib/windowUnit` only, and the many suites that mock
 * `@/lib/settings/useAllSettings` with a factory keep working because this
 * reader is not one of that module's exports (eight table/drawer suites broke
 * the moment it lived there).
 */
import { getNumberSetting, type SettingsBlob } from '@/lib/settings/useAllSettings'
import { isWindowUnit, type WindowUnit } from '@/lib/windowUnit'

export function readWindowSetting(
  values: SettingsBlob | null | undefined,
  key: string,
  defaultAmount: number,
  defaultUnit: WindowUnit = 'days',
): { amount: number; unit: WindowUnit } {
  const amount = getNumberSetting(values, key, defaultAmount)
  const rawUnit = values?.[`${key}_unit`]
  const unit = isWindowUnit(rawUnit) ? rawUnit : defaultUnit
  return { amount, unit }
}
