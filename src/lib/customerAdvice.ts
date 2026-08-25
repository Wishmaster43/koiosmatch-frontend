/**
 * customerAdvice — the ONE deterministic rule engine behind the customers table's
 * "Koios" column. Mirrors candidateAdvice.ts's reference design: rules may ONLY
 * read fields the LIST row already carries (archived, openVacanciesCount) — never
 * a drawer-only field, so the table and any future drawer advice block can never
 * disagree the way the candidates table and drawer once did (Danny 25-07).
 */
import type { Customer } from '@/types/customer'

export type CustomerAdviceAction = 'follow_up' | 'none'

export interface CustomerAdviceRule {
  action: CustomerAdviceAction
  reasonKey: string
}

const NONE_RULE: CustomerAdviceRule = { action: 'none', reasonKey: 'koios.reasons.none' }

// First-match-wins priority ladder — see the file header for the read-set constraint.
export function deriveCustomerAdvice(c: Customer): CustomerAdviceRule {
  // Rule 1: no advice on an archived (soft-deleted) customer.
  if (c.archived) return NONE_RULE

  // Rule 2: no open vacancies — Danny's own example rule ("geen actieve vacatures
  // → Opvolgen"): this customer has gone quiet, worth a follow-up call.
  if ((c.openVacanciesCount ?? 0) === 0) return { action: 'follow_up', reasonKey: 'koios.reasons.noOpenVacancies' }

  // Rule 3: nothing to flag.
  return NONE_RULE
}
