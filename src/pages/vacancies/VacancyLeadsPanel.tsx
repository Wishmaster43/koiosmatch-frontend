/**
 * VacancyLeadsPanel — the expandable list behind the vacancy table's Leads count
 * cell (V14, VAC-LEADS-1). Anchored FloatingPanel opened from the Leads count
 * cell's chevron button (not a DataTable renderExpanded mount — DATATABLE-EXPAND-1
 * was evaluated and not used).
 */
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { useVacancyLeads } from './hooks/useVacancyLeads'
import type { VacancyLeadRow } from './hooks/useVacancyLeads'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { Id } from '@/types/common'

interface VacancyLeadsPanelProps {
  vacancyId: Id
}

// Row list content of the expand panel — loading/error/empty/success handled explicitly (§3).
export default function VacancyLeadsPanel({ vacancyId }: VacancyLeadsPanelProps) {
  const { t } = useTranslation('vacancies')
  const { openEntity } = useNavigation()
  const { formatDate } = useDateFormat()
  const { phaseMeta } = useLookups() as unknown as { phaseMeta: (v: string) => { label: string; color: string } }
  const seedLabel = useSeedLabel()
  // Always enabled here — this component only exists while the panel is open (see docblock).
  const { rows, loading, error } = useVacancyLeads(vacancyId, true)

  if (error) return <div role="alert" style={{ padding: 8, fontSize: 12, color: 'var(--color-danger-text)' }}>{t('leadsExpand.error')}</div>

  const columns: Column<VacancyLeadRow>[] = [
    { key: 'name', header: t('leadsExpand.colName'), sortValue: r => r.name, render: r => r.name || '—' },
    { key: 'phase', header: t('leadsExpand.colPhase'), cellStyle: { color: 'var(--text-muted)' }, render: r => (r.phase ? phaseMeta(r.phase).label : '—') },
    { key: 'source', header: t('leadsExpand.colSource'), cellStyle: { color: 'var(--text-muted)' }, render: r => (r.source ? seedLabel('candidateSources', { label: r.source }) || '—' : '—') },
    { key: 'createdAt', header: t('leadsExpand.colCreated'), cellStyle: { color: 'var(--text-muted)' }, nowrap: true,
      render: r => (r.createdAt ? formatDate(r.createdAt) : '—') },
  ]

  return (
    <DataTable columns={columns} rows={rows} loading={loading}
      loadingText={t('leadsExpand.loading')} emptyText={t('leadsExpand.empty')}
      // CEL-DOORKLIK: a lead row deep-links to the candidate drilldown.
      onRowClick={r => openEntity('candidates', r.id)} />
  )
}
