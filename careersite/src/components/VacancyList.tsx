import type { VacancySummary } from '../types'
import { VacancyCard } from './VacancyCard'
import { strings } from '../strings'

export type VacancyListStatus = 'loading' | 'error' | 'success'

interface VacancyListProps {
  tenant: string
  status: VacancyListStatus
  vacancies: VacancySummary[]
  onRetry: () => void
}

// Dumb list renderer — all four UI states (CLAUDE.md §3: loading/error/empty/success)
// live here as pure branches on props, so it is testable without mocking fetch.
export function VacancyList({ tenant, status, vacancies, onRetry }: VacancyListProps) {
  if (status === 'loading') {
    return <p className="state-notice" role="status">{strings.list.loading}</p>
  }

  if (status === 'error') {
    return (
      <div className="state-notice" role="alert">
        <p>{strings.list.error}</p>
        <button type="button" onClick={onRetry} className="btn btn--secondary">
          {strings.list.retry}
        </button>
      </div>
    )
  }

  if (vacancies.length === 0) {
    return <p className="state-notice">{strings.list.empty}</p>
  }

  return (
    <div className="vacancy-list">
      {vacancies.map((vacancy) => (
        <VacancyCard key={vacancy.reference_number} tenant={tenant} vacancy={vacancy} />
      ))}
    </div>
  )
}
