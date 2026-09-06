/**
 * useCustomerAdvice — the customers table's "Koios" column resolver, the
 * DETERMINISTIC rule-engine card (mirrors useCandidateAdvice's local-engine
 * half). Customer never had a real backend engine behind this card — the old
 * `koios_advice` column it once gated on was never filled by any backend code
 * and has been renamed at the source to `koios_ai_advice` (S1 K-266/K-267, a
 * SEPARATE, real AI advice cache — see `Customer.koiosAiAdvice` /
 * `KoiosAdviceBlock`'s `aiAdvice` prop). So the local rule engine
 * (customerAdvice.ts) is now the only source for this card, unconditionally.
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

// The customers table's Koios-column resolver (see file docblock above): the
// local rule engine always answers — there is no backend-tagged variant.
export function useCustomerAdvice(): (c: Customer) => KoiosAdvice | null {
  const { t } = useTranslation('customers')

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((c: Customer): KoiosAdvice | null => {
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
