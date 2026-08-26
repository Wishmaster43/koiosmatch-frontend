/**
 * ScopedSollicitatiesTab — the Sollicitaties sub-tab body for a location or
 * department drill-down. Extracted out of LocationDetail/DepartmentDetail
 * (§0.3 mini-cleanup, 2026-08-03) where it lived as two near-identical local
 * wrappers; one scope-parameterized component mirrors the ScopedVacanciesTab/
 * ScopedMatchesTab config convention instead of relocating the duplication.
 *
 * Step 1 fetches the level's OWN vacancy ids through the exact query key
 * ScopedVacanciesTab uses (an already-opened Vacatures tab answers from cache),
 * then hands them — plus this step's own loading/error — to
 * CustomerApplicationsList, which owns step 2 (fetch by vacancy_id[]) and folds
 * both into one coherent state. Mounted only while its sub-tab is active, so
 * hosts without a QueryClient never pay for the react-query dependency.
 */
import CustomerApplicationsList from './CustomerApplicationsList'
import { useScopedVacancyIds } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

// Applications tab scoped to one location/department; see the module doc comment
// above for the two-step vacancy-ids→applications loading it drives.
export default function ScopedSollicitatiesTab({ scope, id }: {
  scope: 'location' | 'department'
  id: Id
}) {
  const { vacancyIds, loading, error } = useScopedVacancyIds(scope, id)
  return <CustomerApplicationsList vacancyIds={vacancyIds} vacancyIdsLoading={loading} vacancyIdsError={error} />
}
