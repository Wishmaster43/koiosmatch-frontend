/**
 * ReportStateFlow — render loading/error/empty states with consistent card styling.
 * Adopted on nine report pages (Applications/Candidates/Customers/Matches/Outreach/
 * Opportunities/Tasks/Vacancies/Whatsapp).
 */
import { reportCardStyle as card } from '../ReportSectionCard'
import ReportStateBlock from '../ReportStateBlock'

export function ReportStateFlow({
  loading: isLoading,
  error: hasError,
  empty: isEmpty,
  loadingLabel,
  errorLabel,
  emptyLabel,
  onRetry,
}: {
  loading: boolean
  error: boolean
  empty: boolean
  loadingLabel: string
  errorLabel: string
  emptyLabel: string
  onRetry: () => void
}) {
  if (!isLoading && !hasError && !isEmpty) return null

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <ReportStateBlock
        loading={isLoading}
        error={hasError}
        empty={isEmpty}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        emptyLabel={emptyLabel}
        onRetry={onRetry}
      />
    </div>
  )
}
