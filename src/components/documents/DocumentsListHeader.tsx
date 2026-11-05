// Shared documents list header row (select-all + column labels) for the customer, vacancy and candidate document lists.
import { useTranslation } from 'react-i18next'

interface DocumentsListHeaderProps {
  gridTemplateColumns: string
  selectAllLabel: string
  allSelected: boolean
  indeterminate: boolean
  onToggleAll: () => void
}

// Inline style kept verbatim: it predates the typography atoms and changing it would alter the frozen drill-down face.
export default function DocumentsListHeader({
  gridTemplateColumns, selectAllLabel, allSelected, indeterminate, onToggleAll,
}: DocumentsListHeaderProps) {
  // Shared UI reads its column labels from the shared namespace (common:documents.*), never from a caller's entity namespace.
  const { t } = useTranslation('common')
  return (
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen candidate/customer drawer face: the header keeps its pre-atom 11/600 muted style verbatim (GroupLabel would uppercase it, Caption would thin it)
    <div style={{ display: 'grid', gridTemplateColumns, alignItems: 'center', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
      {/* Select-all operates on the currently filtered, downloadable rows only. */}
      <input type="checkbox" aria-label={selectAllLabel} checked={allSelected} onChange={onToggleAll}
        ref={el => { if (el) el.indeterminate = indeterminate }}
        style={{ accentColor: 'var(--color-primary)' }} />
      <span>{t('documents.name')}</span><span>{t('documents.type')}</span><span>{t('documents.size')}</span>
    </div>
  )
}
