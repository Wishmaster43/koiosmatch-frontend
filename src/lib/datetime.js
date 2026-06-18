/**
 * datetime — locale-aware date formatting tied to the active language.
 *
 * Replaces the hardcoded 'nl-NL' calls scattered through the candidate screens.
 * The locale follows ThemeContext/i18n, so a German user sees German month names.
 */
import { useTranslation } from 'react-i18next'
import { LOCALE_BY_LANG } from '../i18n'

export function useLocale() {
  const { i18n } = useTranslation()
  return LOCALE_BY_LANG[i18n.language] ?? 'nl-NL'
}

export function useDateFormat() {
  const locale = useLocale()
  const formatDate = (value, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!value) return '—'
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(locale, opts)
  }
  return { locale, formatDate }
}
