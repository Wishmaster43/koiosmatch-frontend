/**
 * notificationParams — localises the interpolation params of a notification row in the
 * VIEWING user's language before the catalogue sentence is built (ONIX Y-003 / FB forms).
 * The server resolves some params in the bureau language (KPI label, formatted numbers,
 * the "Forms: …" suffix, a raw ISO period key); a viewer in another language would see a
 * mixed sentence. Pure and side-effect free apart from reading the i18n catalogue.
 */
import i18n, { LOCALE_BY_LANG } from '@/i18n'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { ddmmyyyy, formatMonthYear } from '@/lib/localDate'
import type { AppNotification } from '@/hooks/useNotifications'

type T = (key: string, opts?: Record<string, unknown>) => string
type Params = Record<string, unknown>

// KPI settings where AT MOST the target is good: the verdict rounds up, the rest round down (mirrors the BE).
const MAXIMUM_KPIS = new Set(['open_tasks_target', 'uncalled_warning_threshold'])

// The Intl locale tag of the active UI language (nl-NL fallback, like useLocale).
function activeLocale(): string {
  return (LOCALE_BY_LANG as Record<string, string>)[i18n?.language ?? ''] ?? 'nl-NL'
}

// A raw period key becomes DD-MM-YYYY (day) or a localised month and year; anything else stays as sent.
export function localizePeriod(period: unknown, locale: string): unknown {
  if (typeof period !== 'string') return period
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period)
  if (day) return ddmmyyyy(new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])))
  const month = /^(\d{4})-(\d{2})$/.exec(period)
  if (month) return formatMonthYear(new Date(Number(month[1]), Number(month[2]) - 1, 1), locale)
  return period
}

// KPI digest: label, rounded value/target and period in the viewer's language; server values stay the fallback.
function localizeKpi(params: Params, meta: Params, t: T, locale: string): Params {
  const out: Params = { ...params }
  const kpi = typeof meta.kpi === 'string' ? meta.kpi : typeof params.kpi === 'string' ? params.kpi : null
  if (kpi && i18n.exists(`kpi.labels.${kpi}`, { ns: 'notifications' })) out.label = t(`kpi.labels.${kpi}`, { ns: 'notifications' })
  if (kpi) {
    const round = MAXIMUM_KPIS.has(kpi) ? Math.ceil : Math.floor
    const show = (raw: unknown) => {
      const n = typeof raw === 'number' ? raw : Number.NaN
      if (!Number.isFinite(n)) return null
      return kpi === 'fill_rate_target' ? formatPercent(round(n), locale) : formatNumber(round(n), locale)
    }
    const value = show(meta.value)
    const target = show(meta.target)
    if (value !== null) out.value = value
    if (target !== null) out.target = target
  }
  return out
}

// Facebook forms suffix: rebuilt from the raw ids in the viewer's language; a legacy server-built suffix in another language is dropped.
function localizeForms(params: Params, t: T): Params {
  const rawIds = params.form_ids
  const ids = Array.isArray(rawIds) ? rawIds.join(', ') : typeof rawIds === 'string' ? rawIds : ''
  if (ids) return { ...params, forms: t('facebook.forms_suffix', { ns: 'notifications', forms: ids, interpolation: { escapeValue: false } }) }
  if (typeof params.forms === 'string' && params.forms) {
    // The viewer-language suffix starts with a fixed lead-in; a different lead-in means a bureau-language island.
    const lead = t('facebook.forms_suffix', { ns: 'notifications', forms: '\u0000', interpolation: { escapeValue: false } }).split('\u0000')[0]
    if (!params.forms.startsWith(lead)) return { ...params, forms: '' }
  }
  return params
}

// The row's params, localised to the viewer; the input is never mutated.
export function localizeNotificationParams(n: AppNotification, t: T): Params | undefined {
  let params = n.params
  if (!params) return params
  const locale = activeLocale()
  const key = `${n.title_key ?? ''} ${n.body_key ?? ''}`
  const meta = (n.meta && typeof n.meta === 'object' ? n.meta : {}) as Params
  if (key.includes('.kpi.below_target')) params = localizeKpi(params, meta, t, locale)
  if (key.includes('.facebook.')) params = localizeForms(params, t)
  if ('period' in params) params = { ...params, period: localizePeriod(params.period, locale) }
  return params
}
