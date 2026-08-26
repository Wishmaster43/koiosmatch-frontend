/**
 * useCustomerAdvice — the customers table's "Koios" column resolver. Mirrors
 * useCandidateAdvice's honest gate: the backend `koios_advice` column is filled
 * by the seeder with an untagged action/reason (no real engine runs yet), so it
 * is only trusted once it declares a real origin — i.e. `advice.source` is a
 * non-empty string. Until then the local rule engine (customerAdvice.ts)
 * answers; this gate auto-lifts the moment the backend ships a tagged source.
 *
 * Action labels live in the SHARED `common:koios.actions.*` block (Danny 05-08
 * consistency pass) — new advice actions (follow_up, attention, renew, overdue)
 * are reused across entities, so they get ONE i18n home instead of one per table.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { deriveCustomerAdvice } from '@/lib/customerAdvice'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Customer } from '@/types/customer'

// The customers table's Koios-column resolver (see file docblock above): trusts
// the backend's advice only once it carries a real, non-seeded source.
export function useCustomerAdvice(): (c: Customer) => KoiosAdvice | null {
  const { t } = useTranslation('customers')

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((c: Customer): KoiosAdvice | null => {
    // Trust the backend value only once it declares a real, non-seeded origin.
    const backendSource = typeof c.koiosAdvice?.source === 'string' ? c.koiosAdvice.source : null
    if (backendSource) {
      const backendAction = c.koiosAdvice?.action ?? 'none'
      if (backendAction === 'none') return null
      return {
        action: backendAction,
        label: c.koiosAdvice?.label || t(`common:koios.actions.${backendAction}`, { defaultValue: backendAction }),
        reason: c.koiosAdvice?.reason ?? null,
        source: backendSource,
      }
    }

    const rule = deriveCustomerAdvice(c)
    if (rule.action === 'none') return null

    return {
      action: rule.action,
      label: t('common:koios.actions.follow_up'),
      reason: t(rule.reasonKey, { defaultValue: 'No open vacancies — follow up with this customer.' }),
      source: 'rules',
    }
  }, [t])
}
