/**
 * AccountManagersReport — customer ownership per account manager (REPORTS-ACCTMGR-1).
 * There is no dedicated `accountManager` role/axis and no `/reports/accountmanagers`
 * endpoint. What DOES exist and IS an honest account-manager view: the customers
 * report's `by_owner` axis (`GET /reports/customers`, reused via `useCustomersReport`,
 * already fetched by CustomersReport) — the customer's owner IS the account manager
 * in this tenant's model (mirrors how RecruitersReport reads the candidate owner as
 * "recruiter"). This report renders that axis as a per-manager table, exactly the
 * population it already represents (customers created in the window, per owner) —
 * it does not borrow any other report's numbers under this label. A real
 * per-manager productivity report (open opportunities, active matches, revenue) would
 * need a dedicated backend aggregation the current payload does not carry — those
 * KPI slots stay dashed; see reportIds.ts / WORKLIST for the exact backend ask.
 */
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/formatters'
import ReportKpiBand from './ReportKpiBand'
import ReportStateBlock from './ReportStateBlock'
import { ReportSectionCard } from './ReportSectionCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { useCustomersReport } from './useCustomersReport'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { ReportPeriod, CandidateOwnerSegment } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)

export default function AccountManagersReport({ period, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error, refetch } = useCustomersReport(period, filters)
  const rows = data?.by_owner ?? []

  const totalCustomers = data?.total ?? 0
  const managerCount = rows.length
  // A plain decimal ratio (customers per manager, e.g. 3.5), NOT a 0-1 fraction —
  // formatRatio would misread this as a percentage, so this uses formatNumber.
  const avgPerManager = managerCount > 0 ? Math.round((totalCustomers / managerCount) * 10) / 10 : null
  const topManager = [...rows].sort((a, b) => b.count - a.count)[0]

  // Nine slots, always. Four real numbers from `by_owner`; five dashes for
  // per-manager productivity metrics this payload does not carry (no
  // opportunities/matches/revenue-per-owner axis exists today).
  const kpiByKey: Record<string, KpiSpec> = {
    accountManagers: { key: 'accountManagers', label: t('accountmanagers.summary.accountManagers'), value: managerCount },
    customers: { key: 'customers', label: t('accountmanagers.summary.customersInWindow'), value: totalCustomers },
    avgPerManager: { key: 'avgPerManager', label: t('accountmanagers.summary.avgPerManager'), value: formatNumber(avgPerManager) },
    topManager: { key: 'topManager', label: t('accountmanagers.summary.topManager'),
      value: topManager ? `${topManager.name} · ${topManager.count}` : '—' },
    openOpportunities: { key: 'openOpportunities', label: t('accountmanagers.summary.openOpportunities'), value: '—' },
    activeMatches: { key: 'activeMatches', label: t('accountmanagers.summary.activeMatches'), value: '—' },
    revenue: { key: 'revenue', label: t('accountmanagers.summary.revenue'), value: '—' },
    renewalsDue: { key: 'renewalsDue', label: t('accountmanagers.summary.renewalsDue'), value: '—' },
    notContacted: { key: 'notContacted', label: t('accountmanagers.summary.notContacted'), value: '—' },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('accountmanagers').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('accountmanagers')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('accountmanagers'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  const columns: Column<CandidateOwnerSegment>[] = [
    { key: 'name', header: t('accountmanagers.cols.manager'), sortable: true, sortValue: r => r.name ?? '', render: r => r.name },
    { key: 'customers', header: t('accountmanagers.cols.customers'), align: 'right', sortable: true, sortValue: r => r.count, render: r => numCell(r.count) },
  ]

  return (
    <div>
      {/* KPI strip — above the table (candidate-page order: KPIs first) */}
      {!loading && !error && rows.length > 0 && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('accountmanagers.kpiOrderFellBack') : undefined} />
      )}

      <ReportSectionCard>
        {error && !loading ? (
          <ReportStateBlock
            loading={false} error empty={false}
            loadingLabel={t('accountmanagers.loading')} errorLabel={t('accountmanagers.error')} emptyLabel={t('accountmanagers.empty')}
            onRetry={() => refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={r => r.owner_id}
            loading={loading}
            loadingText={t('accountmanagers.loading')}
            emptyText={t('accountmanagers.empty')}
          />
        )}
      </ReportSectionCard>
    </div>
  )
}
