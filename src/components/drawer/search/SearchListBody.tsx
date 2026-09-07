// Shared list body for search tabs (loading/error/empty/rows states).
// The row rendering is delegated to a render function so each tab keeps its own row component.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import type { SearchableRow } from './useSearchSelection'

export interface SearchListBodyProps<T extends SearchableRow> {
  // Four explicit UI states.
  loading: boolean
  error: boolean
  rows: T[]
  onRetry: () => void
  // Empty state: optional no-location row with a geocode button (GEO-DEGRADE-1).
  noLocation?: boolean
  // Components for the empty state message (passed by the parent tab).
  emptyMessage: ReactNode
  noLocationMessage: ReactNode
  noLocationButton?: ReactNode
  // Render function for each row (delegates to the tab's own row component).
  renderRow: (row: T, isSelected: boolean, onSelect: (id: string | number) => void) => ReactNode
  selectedId: string | number | null
  onSelect: (id: string | number) => void
}

export function SearchListBody<T extends SearchableRow>({
  loading, error, rows, onRetry,
  noLocation, emptyMessage, noLocationMessage, noLocationButton,
  renderRow, selectedId, onSelect,
}: SearchListBodyProps<T>) {
  const { t } = useTranslation('common')

  if (loading) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('loading')}</div>
  }

  if (error) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('error.body')}</span>
        <Button variant="secondary" size="sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          {t('error.retry')}
        </Button>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {noLocation ? noLocationMessage : emptyMessage}
        </span>
        {noLocation && noLocationButton}
      </div>
    )
  }

  // Success: render the filtered list (drop the selected row to avoid duplicate with the card).
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.filter(r => r.id !== selectedId).map(r => (
        <div key={String(r.id)}>
          {renderRow(r, r.id === selectedId, onSelect)}
        </div>
      ))}
    </div>
  )
}
