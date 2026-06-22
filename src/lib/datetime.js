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
  // Default to numeric DD-MM-YYYY (the app-wide standard, see CLAUDE.md §3B).
  const formatDate = (value, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) => {
    if (!value) return '—'
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(locale, opts)
  }
  return { locale, formatDate }
}
