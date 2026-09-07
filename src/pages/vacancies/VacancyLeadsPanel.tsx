/**
 * VacancyLeadsPanel — the expandable list behind the vacancy table's Leads count
 * cell (V14, VAC-LEADS-1). Anchored FloatingPanel opened from the Leads count
 * cell's chevron button (not a DataTable renderExpanded mount — DATATABLE-EXPAND-1
 * was evaluated and not used).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { useVacancyLeads, useRecountVacancyLeads } from './hooks/useVacancyLeads'
import type { VacancyLeadRow } from './hooks/useVacancyLeads'
import { useNavigation } from '@/context/NavigationContext'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { notifyError, notifySuccess } from '@/lib/notify'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import type { Id } from '@/types/common'

interface VacancyLeadsPanelProps {
  vacancyId: Id
}

// Row list content of the expand panel — loading/error/empty/success handled explicitly (§3).
export default function VacancyLeadsPanel({ vacancyId }: VacancyLeadsPanelProps) {
  const { t } = useTranslation('vacancies')
  const { openEntity } = useNavigation()
  const auth = useAuth()
  const hasPermission = auth?.hasPermission || (() => false)
  const { formatDate } = useDateFormat()
  const { phaseMeta } = useLookups() as unknown as { phaseMeta: (v: string) => { label: string; color: string } }
  const seedLabel = useSeedLabel()
  const [recountLoading, setRecountLoading] = useState(false)
  const [recountQueued, setRecountQueued] = useState(false)
  const { mutate: recountLeads } = useRecountVacancyLeads()
  // Always enabled here — this component only exists while the panel is open (see docblock).
  const { rows, loading, error } = useVacancyLeads(vacancyId, true)

  // Trigger a manual recount — POST /vacancies/{id}/leads/recount, handle 429 throttle.
  const handleRecount = async () => {
    setRecountLoading(true)
    try {
      await recountLeads(vacancyId)
      setRecountQueued(true)
      notifySuccess(t('leadsExpand.recountQueued'))
      // Reset after 5s so a second recount is possible later.
      setTimeout(() => setRecountQueued(false), 5000)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number } }
      if (axiosErr.response?.status === 429) {
        notifyError(t('leadsExpand.recountThrottled'))
      } else {
        notifyError(t('leadsExpand.recountFailed'))
      }
    } finally {
      setRecountLoading(false)
    }
  }

  if (error) return <div role="alert" style={{ padding: 8, fontSize: 12, color: 'var(--color-danger-text)' }}>{t('leadsExpand.error')}</div>

  const columns: Column<VacancyLeadRow>[] = [
    { key: 'name', header: t('leadsExpand.colName'), sortValue: r => r.name, render: r => r.name || '—' },
    { key: 'phase', header: t('leadsExpand.colPhase'), cellStyle: { color: 'var(--text-muted)' }, render: r => (r.phase ? phaseMeta(r.phase).label : '—') },
    { key: 'source', header: t('leadsExpand.colSource'), cellStyle: { color: 'var(--text-muted)' }, render: r => (r.source ? seedLabel('candidateSources', { label: r.source }) || '—' : '—') },
    { key: 'createdAt', header: t('leadsExpand.colCreated'), cellStyle: { color: 'var(--text-muted)' }, nowrap: true,
      render: r => (r.createdAt ? formatDate(r.createdAt) : '—') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Recount button — gated on vacancies.update permission; fires only when the panel is open. */}
      {hasPermission('vacancies.update') && (
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRecount}
          disabled={recountLoading}
        >
          <RefreshCw size={14} />
          {t('leadsExpand.recountBtn')}
        </Button>
      )}

      {/* Queued confirmation callout — calm info message that fades after 5s. */}
      {recountQueued && (
        <CalloutBox variant="info">
          {t('leadsExpand.recountInfo')}
        </CalloutBox>
      )}

      {/* Table — CEL-DOORKLIK: a lead row deep-links to the candidate drilldown. */}
      <DataTable columns={columns} rows={rows} loading={loading}
        loadingText={t('leadsExpand.loading')} emptyText={t('leadsExpand.empty')}
        onRowClick={r => openEntity('candidates', r.id)} />
    </div>
  )
}
