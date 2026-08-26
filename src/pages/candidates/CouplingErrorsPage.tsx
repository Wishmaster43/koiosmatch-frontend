/**
 * CouplingErrorsPage — the deep-link destination behind the dashboard
 * `coupling_errors` KPI tile (K-173 fase 5). Not a sidebar item: it only
 * exists so a tile click lands somewhere real instead of the generic
 * candidates list. Lists every backoffice mapping whose last sync attempt
 * failed, with the reason, so a recruiter can see and act on what is broken.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import ErrorBanner from '@/components/ui/ErrorBanner'
import SoftChip from '@/components/ui/SoftChip'
import EntityLink from '@/components/ui/EntityLink'
import { BodyText, Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useCouplingErrors, type CouplingErrorRow } from './hooks/useCouplingErrors'

// entity_type → app-shell page key, the same vocabulary NotificationBell's
// ENTITY_PAGE / KoiosForYouCard's CREATED_ENTITY_PAGE use — never invent a route.
const ENTITY_PAGE: Record<string, string> = {
  candidate: 'candidates', lead: 'candidates', application: 'applications',
  vacancy: 'vacancies', match: 'matches', task: 'tasks',
  opportunity: 'opportunities', customer: 'customers',
}

// system → soft-chip tint (mirrors the sm_/hf_ endpoint-prefix distinction, §10).
const SYSTEM_COLOR: Record<string, string> = {
  shiftmanager: 'var(--color-info-text)',
  helloflex: 'var(--color-warning-text)',
}

// The dashboard KPI tile's deep-link destination (see file docblock above) —
// lists every failed backoffice mapping so a recruiter can act on it.
export default function CouplingErrorsPage() {
  const { t } = useTranslation('candidates')
  const { formatDateTime } = useDateFormat()
  const { rows, loading, error, refetch } = useCouplingErrors()

  // Columns handed to the shared DataTable (§3A) — sorting/keyboard reach live there.
  const columns: Column<CouplingErrorRow>[] = useMemo(() => [
    {
      key: 'entity', header: t('couplingErrors.col.entity'), sortable: true,
      sortValue: r => r.entity_label ?? r.entity_type,
      render: r => {
        const page = ENTITY_PAGE[r.entity_type]
        const label = r.entity_label ?? `${r.entity_type} · ${r.entity_id}`
        // Unknown/unmapped entity_type: plain text, never a link to nowhere.
        return page
          ? <EntityLink page={page} id={r.entity_id}>{label}</EntityLink>
          : <BodyText>{label}</BodyText>
      },
    },
    {
      key: 'system', header: t('couplingErrors.col.system'), sortable: true,
      sortValue: r => r.system,
      render: r => <SoftChip label={t(`couplingErrors.system.${r.system}`, { defaultValue: r.system })} color={SYSTEM_COLOR[r.system]} />,
    },
    {
      key: 'error', header: t('couplingErrors.col.error'),
      render: r => <BodyText title={r.error} style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.error}</BodyText>,
    },
    {
      key: 'synced_at', header: t('couplingErrors.col.lastAttempt'), sortable: true,
      sortValue: r => r.synced_at ? new Date(r.synced_at).getTime() : null,
      render: r => <Caption>{formatDateTime(r.synced_at)}</Caption>,
    },
  ], [t, formatDateTime])

  return (
    <div className="flex flex-col h-full p-6">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('couplingErrors.title')}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('couplingErrors.subtitle')}</p>
      </div>

      {/* Explicit error state (§3): the fetch itself failed, distinct from an empty result. */}
      {error && (
        <ErrorBanner style={{ marginBottom: 12 }} onRetry={() => refetch()}>
          {t('couplingErrors.error')}
        </ErrorBanner>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          <DataTable
            columns={columns}
            rows={error ? [] : rows}
            getRowId={r => `${r.system}:${r.entity_type}:${r.entity_id}`}
            loading={loading}
            loadingText={t('couplingErrors.loading')}
            emptyText={t('couplingErrors.empty')}
            defaultSort={{ key: 'synced_at', dir: 'desc' }}
          />
        </div>
      </div>
    </div>
  )
}
