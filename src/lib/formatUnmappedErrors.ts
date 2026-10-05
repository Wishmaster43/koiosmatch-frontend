/**
 * formatUnmappedErrors — ONIX N-005: turns the unmapped 422 entries (bag keys
 * no form field renders, e.g. a required tenant custom field) into one banner
 * string, or null when there is nothing to show. Laravel's own untranslated
 * "required" sentence is rewritten via the injected `t` (DATETIME-IMPORT-LES:
 * this module stays pure, i18n lives in the caller) instead of leaking the
 * raw English template to a non-EN tenant.
 */
import { RAW_REQUIRED_RE } from './extractApiError'
import type { UnmappedEntry } from './extractFormErrors'

type Translate = (key: string, opts?: Record<string, unknown>) => string

// The key's last dot-segment is the human-facing field name (custom_fields.vog -> vog).
const lastSegment = (key: string): string => key.split('.').pop() ?? key

// Joins every unmapped entry's message into one banner sentence, or null when the list is empty.
export function formatUnmappedErrors(list: UnmappedEntry[], t: Translate): string | null {
  if (!list.length) return null
  return list
    .map(({ key, message }) => {
      if (message && RAW_REQUIRED_RE.test(message)) {
        return t('common:validation.fieldRequiredNamed', { field: lastSegment(key) })
      }
      return message ?? t('common:validation.fieldRequiredNamed', { field: lastSegment(key) })
    })
    .join(' ')
}
