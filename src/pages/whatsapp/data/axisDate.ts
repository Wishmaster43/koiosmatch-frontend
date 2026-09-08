import { formatMonthName } from '@/lib/localDate'

/**
 * axisDate — the short "25 aug" axis label both WhatsApp activity charts use, in
 * its own module so the components file keeps exporting components only.
 * `locale` is required (DATUM-1/LANE-B): a pure module-scope helper never
 * hardcodes nl-NL or imports i18n — callers pass the active app locale.
 */
export function fmtAxisDate(dateStr: string, locale: string) {
  const [, m, d] = dateStr.split('-')
  const monthAbbr = formatMonthName(new Date(2000, parseInt(m) - 1, 1), locale, 'short')
  return `${parseInt(d)} ${monthAbbr}`
}
