/**
 * useCustomerCascade — thin re-export of the shared implementation. Promoted to
 * `src/hooks/useCustomerCascade.ts` (audit R1 item 2: this exact customer→
 * location→department→contact fetch was triplicated across opportunities/
 * candidates/vacancies). Kept as a re-export here so CustomerTab/AddOpportunityModal
 * don't need their imports touched — one implementation, consumed from two paths.
 */
export { useCustomerCascade } from '@/hooks/useCustomerCascade'
