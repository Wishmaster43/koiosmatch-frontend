// AVG-RET-2-TAAL-1: the ONE messaging-language option list every picker uses
// (candidate profile, contact detail, create modals, agency default setting).
// Defaults (MESSAGING_LANGUAGES) come first in their canonical order, then the
// addable codes sorted alphabetically by their display name in the UI locale.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MESSAGING_LANGUAGES } from '@/modules/messagingLanguages'
import { languageDisplayName, ADDABLE_LANGUAGE_CODES } from '@/lib/languageNames'

interface MessagingLanguageOption {
  value: string
  label: string
}

// Build the one shared messaging-language option list, localized to the current UI language.
export function useMessagingLanguageOptions() {
  const { i18n } = useTranslation()
  const uiLocale = i18n?.language || 'nl'

  // Build "<name> (<CODE>)" labels; defaults first, then addable codes A→Z by name.
  const options = useMemo<MessagingLanguageOption[]>(() => {
    const toOption = (code: string): MessagingLanguageOption => ({
      value: code,
      label: `${languageDisplayName(code, uiLocale)} (${code.toUpperCase()})`,
    })
    const defaults = MESSAGING_LANGUAGES.map(toOption)
    const addable = ADDABLE_LANGUAGE_CODES.map(toOption)
      .sort((a, b) => a.label.localeCompare(b.label, uiLocale))
    return [...defaults, ...addable]
  }, [uiLocale])

  // Look up the display label for a stored code, falling back to the code itself.
  const labelFor = (code: string): string => {
    const found = options.find(o => o.value === code)
    return found ? found.label : languageDisplayName(code, uiLocale)
  }

  return { options, labelFor }
}
