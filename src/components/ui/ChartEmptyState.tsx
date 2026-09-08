/**
 * ChartEmptyState — shared empty-state render for all chart cards when no data is available.
 * Extracted from identical BarChartCard and PieChartCard implementations.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface ChartEmptyStateProps {
  /** Optional title shown above the empty-state message. */
  title?: ReactNode
}

// Renders a centered, muted empty-state message for charts with no data.
export default function ChartEmptyState({ title }: ChartEmptyStateProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {title && <div className="mb-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</div>}
      <div className="flex items-center justify-center h-40 text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('noData')}
      </div>
    </div>
  )
}
