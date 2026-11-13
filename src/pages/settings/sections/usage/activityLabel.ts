import type { TFunction } from 'i18next'
import { labelOrRaw, type KeyChecker } from '@/lib/labelOrRaw'

// Translate a raw activity code via the activity map (ns settings), falling back to the raw code so an unmapped future code still renders (§0.5).
export function activityLabel(t: TFunction, i18n: KeyChecker, code: string): string {
  return labelOrRaw(t, i18n, `billing.usage.activity.activityMap.${code}`, code, 'settings')
}
