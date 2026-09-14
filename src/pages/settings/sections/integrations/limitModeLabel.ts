/**
 * limitModeLabel — the one place that turns a connector's behaviour-at-the-cap
 * (`signal`/`queue`/`block`) into its translated word, shared by the super-admin
 * platform/tenant editors and the tenant "bij bereiken: …" line (LIMITS-BEHEER-1).
 */
import type { TFunction } from 'i18next'
import type { LimitMode } from './limitsApi'

// The mode picker's option list, in the order Danny reads them (§2 point 3).
export const LIMIT_MODES: LimitMode[] = ['signal', 'queue', 'block']

// One translated word per mode. Caller passes the 'settings' namespace's own
// t (useTranslation('settings')), so keys stay relative here — not prefixed.
export function limitModeLabel(t: TFunction, mode: LimitMode | null | undefined): string {
  return t(`limits.mode.${mode ?? 'signal'}`)
}

// The tenant-facing sentence: "bij bereiken: doorgaan / wachtrij / geblokkeerd".
export function limitModeSentence(t: TFunction, mode: LimitMode | null | undefined): string {
  return `${t('limits.at_cap_prefix')} ${limitModeLabel(t, mode)}`
}
