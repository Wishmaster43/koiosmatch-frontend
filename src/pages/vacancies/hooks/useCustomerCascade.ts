/**
 * useCustomerCascade — thin re-export of the shared implementation. Audit R1
 * item 4: this exact customer→location→department→contact fetch was
 * triplicated across opportunities/candidates/vacancies; promoted to
 * `src/hooks/useCustomerCascade.ts` (mirrors how opportunities already did
 * this re-export). Kept as a re-export here so DetailsTab/useCascadePickers
 * don't need their imports touched — one implementation, consumed from two paths.
 */
export { useCustomerCascade } from '@/hooks/useCustomerCascade'
