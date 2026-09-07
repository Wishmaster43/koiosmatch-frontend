/**
 * ReportEmptyState — shared empty-state paragraph for all report tables.
 * Renders a centered message when no rows match the current filters.
 */
interface ReportEmptyStateProps {
  message: string
  height?: number
}

export default function ReportEmptyState({ message, height = 160 }: ReportEmptyStateProps) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{message}</p>
    </div>
  )
}
