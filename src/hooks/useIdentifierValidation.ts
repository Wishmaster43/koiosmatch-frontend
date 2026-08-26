/**
 * useIdentifierValidation — binds the pure `lib/companyIdentifiers` rules to the
 * tenant's `company_identifier_validation` setting and to i18n, so every screen
 * that collects a KvK/BTW number (customer, customer location, tenant branch,
 * ZZP profile) asks ONE question and gets one message back (Danny 2026-08-08,
 * points 10 + 11).
 *
 * Returns a `notice(kind, value, country)` that yields either null (nothing to
 * say) or `{ message, severity }`. Severity 'error' means the tenant chose to
 * BLOCK; 'warning' is a hint the user may save straight through. Components
 * never touch the regexes or the setting themselves.
 */
import { useTranslation } from 'react-i18next'
import {
  checkIdentifier, identifierSeverity, parseIdentifierValidationMode,
  IDENTIFIER_VALIDATION_SETTING,
} from '@/lib/companyIdentifiers'
import type { IdentifierKind, IdentifierValidationMode } from '@/lib/companyIdentifiers'
import { getCountryName } from '@/lib/countries'
import { useAllSettings } from '@/lib/settings/useAllSettings'

export interface IdentifierNotice {
  message: string
  severity: 'error' | 'warning'
}

export interface IdentifierValidation {
  /** The tenant's current behaviour on a mismatch. */
  mode: IdentifierValidationMode
  /** Null when the value is empty or well-formed; otherwise what to show. */
  notice: (kind: IdentifierKind, value: string | null | undefined, country: string | null | undefined) => IdentifierNotice | null
}

// Reads the tenant's configured identifier-validation strictness and returns a
// notice builder so every identifier field applies the same mode consistently.
export function useIdentifierValidation(): IdentifierValidation {
  const { t, i18n } = useTranslation('common')
  const settings = useAllSettings()
  const mode = parseIdentifierValidationMode(settings[IDENTIFIER_VALIDATION_SETTING])

  // One check → one message. The country NAME is resolved through Intl (no extra
  // translation keys), the expected shape is a real-world example, not a label.
  const notice: IdentifierValidation['notice'] = (kind, value, country) => {
    const result = checkIdentifier(kind, value, country)
    const severity = identifierSeverity(result, mode)
    if (!severity) return null
    if (result.status === 'unverifiable') {
      const message = kind === 'coc' ? t('identifierCheck.cocUnverifiable') : t('identifierCheck.vatUnverifiable')
      return { message, severity }
    }
    const params = {
      country: getCountryName(result.countryCode ?? '', i18n.language),
      example: result.example ?? '',
    }
    const message = kind === 'coc' ? t('identifierCheck.cocInvalid', params) : t('identifierCheck.vatInvalid', params)
    return { message, severity }
  }

  return { mode, notice }
}
