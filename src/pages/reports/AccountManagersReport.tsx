/**
 * AccountManagersReport — productivity per account manager, mirror-image of
 * RecruitersReport on the customer side (GET /reports/accountmanagers,
 * Customer.owner_id = account manager). REPORTS-ACCTMGR-1 follow-up: the
 * backend shipped the real endpoint (own customers, open vacancies, filled
 * positions, opportunities, contracts ending soon, not-contacted) and, K-67,
 * its compare counterpart — this now reads that real data instead of the
 * customers-report `by_owner` axis stand-in.
 *
 * RAPPORT-COMPARE-1 (K-67): same mechanism as CandidatesReport (the reference
 * adoption) — ReportCompareControl + useReportCompare + ReportCompareMetric,
 * never a second compare mechanism. Two things this report alone needs:
 * (1) `months`/`contract_ending_days` are explicit escapes from a tenant SETTING
 * that must reach BOTH windows at once — one override state, reused verbatim
 * (accountManagersOverrideParams) for the plain fetch and the single compare
 * call's extraParams, so the two halves can never measure a different
 * threshold. (2) the comparator also wraps `compliance_days`/`contract_ending_days`
 * themselves in a {current,previous,delta} envelope — those are an echo of the
 * setting applied, not a metric, so only `.current` ever renders, never a delta.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber, formatRatio } from '@/lib/formatters'
import ReportKpiBand from './ReportKpiBand'
import ReportStateBlock from './ReportStateBlock'
import { ReportSectionCard } from './ReportSectionCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { useAccountManagersReport, accountManagersOverrideParams } from './useAccountManagersReport'
import type { AccountManagersOverrides } from './useAccountManagersReport'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import type { CompareMetric } from './useReportCompare'
import ReportCompareControl from './ReportCompareControl'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import { sumCompareMetric } from './reportCompareAggregate'
import type { CompareDiffedRow } from './reportCompareAggregate'
import type { ReportPeriod, AccountManagerRow } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)
// A count-column cell that also carries the "needs attention" warning tint > 0
// (mirrors RecruitersReport's not_contacted column).
const attentionCell = (n: number) => <span style={{ color: n > 0 ? 'var(--color-warning)' : 'var(--text)' }}>{n}</span>

const inputStyle = { width: 64, fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }
const overrideLabelStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' } as const

export default function AccountManagersReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')

  // Threshold overrides — explicit escapes from the customer_no_contact_days /
  // customer_contract_ending_days tenant settings. `undefined` = use the
  // tenant's own setting (never a client-guessed default). ONE state object,
  // read through the ONE shared `accountManagersOverrideParams` — the plain
  // fetch below and the compare call further down both derive from it, so an
  // override can never reach one and not the other.
  const [months, setMonths] = useState<number | undefined>(undefined)
  const [contractEndingDays, setContractEndingDays] = useState<number | undefined>(undefined)
  const overrides: AccountManagersOverrides = { months, contractEndingDays }

  const { data, loading, error, refetch } = useAccountManagersReport(period, overrides)
  const rows = data?.account_managers ?? []
  const hasData = !loading && !error && rows.length > 0

  // RAPPORT-COMPARE-1: reference adoption (reportCompareSupport.ts). The SAME
  // override params object feeds this call's extraParams — one backend call,
  // one threshold, both windows (ReportCompareController::run applies `shared`
  // params, months/contract_ending_days included, to both the current and the
  // previous run() — never a per-window override from this component).
  const compareSlug = getCompareSlug('people', 'accountmanagers')
  const [compareMode, setCompareMode] = useState<ReportCompareMode>(COMPARE_OFF)
  const compareBaseParams = accountManagersOverrideParams(overrides)
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compareMode, compareBaseParams)
  const compareRows = (compareData?.account_managers as CompareDiffedRow[] | undefined) ?? []
  // Team-total compare metrics — the backend only diffs PER-ROW fields for this
  // report (no top-level scalar total exists), so the KPI band's totals are
  // summed client-side from the already-diffed rows (reportCompareAggregate.ts;
  // real numbers the backend computed, never fabricated). `null` while compare
  // is off or still loading, so a KPI card never flashes a false "+0" delta.
  const compareMetrics: Record<string, CompareMetric> | null = compareMode.kind !== 'off' && compareData
    ? {
        customers: sumCompareMetric(compareRows, 'customers'),
        open_vacancies: sumCompareMetric(compareRows, 'open_vacancies'),
        filled_positions: sumCompareMetric(compareRows, 'filled_positions'),
        opportunities: sumCompareMetric(compareRows, 'opportunities'),
        contract_ending: sumCompareMetric(compareRows, 'contract_ending'),
        not_contacted: sumCompareMetric(compareRows, 'not_contacted'),
      }
    : null
  // The comparator wraps compliance_days/contract_ending_days (SCALAR CONFIG
  // VALUES, not metrics) in the same {current,previous,delta} envelope — only
  // `.current` (the threshold BOTH windows actually used) ever renders below;
  // `.previous`/`.delta`/`.delta_pct` are never read for these two fields.
  const complianceCompare = compareData?.compliance_days as CompareMetric | undefined
  const contractEndingCompare = compareData?.contract_ending_days as CompareMetric | undefined

  // Team totals — plain sums across the CURRENT (non-compare) rows, exactly
  // like the table itself; the KPI band never mixes compare-window numbers
  // into the "current" figure it shows.
  const sum = (pick: (r: AccountManagerRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0)
  const totalCustomers = sum(r => r.customers)
  const totalOpenVacancies = sum(r => r.open_vacancies)
  const totalFilledPositions = sum(r => r.filled_positions)
  const totalOpportunities = sum(r => r.opportunities)
  const totalContractEnding = sum(r => r.contract_ending)
  const totalNotContacted = sum(r => r.not_contacted)
  const managerCount = rows.length
  // A plain decimal ratio (customers per manager, e.g. 3.5), NOT a 0-1 fraction —
  // formatRatio would misread this as a percentage, so this uses formatNumber.
  const avgPerManager = managerCount > 0 ? Math.round((totalCustomers / managerCount) * 10) / 10 : null
  const topManager = [...rows].sort((a, b) => b.customers - a.customers)[0]

  // Nine real cards (REPORTS-ACCTMGR-1 follow-up closed the five placeholder
  // dashes) — a card carries a compare `sub` only once compareMetrics is ready.
  // Direction follows the FIGURE's own meaning (reportComparePolarity.ts), never
  // the raw sign: a bigger book / more placements / more pipeline rising is
  // good news (up-good); more contracts due to end soon or more customers
  // falling out of touch rising is NOT (down-good) even though the delta is
  // positive — mirrors RecruitersReport's own warning tint on the same two
  // attention metrics. `open_vacancies` stays neutral — more open demand is
  // neither unambiguously good nor bad, so this never guesses a colour claim.
  const kpiByKey: Record<string, KpiSpec> = {
    accountManagers: { key: 'accountManagers', label: t('accountmanagers.summary.accountManagers'), value: managerCount },
    customers: {
      key: 'customers', label: t('accountmanagers.summary.customersInWindow'), value: totalCustomers,
      sub: compareMetrics ? <ReportCompareMetric metric={compareMetrics.customers} polarity="up-good" /> : undefined,
    },
    avgPerManager: { key: 'avgPerManager', label: t('accountmanagers.summary.avgPerManager'), value: formatNumber(avgPerManager) },
    topManager: { key: 'topManager', label: t('accountmanagers.summary.topManager'),
      value: topManager ? `${topManager.label} · ${topManager.customers}` : '—' },
    openVacancies: {
      key: 'openVacancies', label: t('accountmanagers.summary.openVacancies'), value: totalOpenVacancies,
      sub: compareMetrics ? <ReportCompareMetric metric={compareMetrics.open_vacancies} polarity="neutral" /> : undefined,
    },
    filledPositions: {
      key: 'filledPositions', label: t('accountmanagers.summary.filledPositions'), value: totalFilledPositions,
      sub: compareMetrics ? <ReportCompareMetric metric={compareMetrics.filled_positions} polarity="up-good" /> : undefined,
    },
    opportunities: {
      key: 'opportunities', label: t('accountmanagers.summary.opportunities'), value: totalOpportunities,
      sub: compareMetrics ? <ReportCompareMetric metric={compareMetrics.opportunities} polarity="up-good" /> : undefined,
    },
    renewalsDue: {
      key: 'renewalsDue', label: t('accountmanagers.summary.renewalsDue'), value: totalContractEnding,
      color: totalContractEnding > 0 ? 'var(--color-warning)' : undefined,
      sub: compareMetrics ? <ReportCompareMetric metric={compareMetrics.contract_ending} polarity="down-good" /> : undefined,
    },
    notContacted: {
      key: 'notContacted', label: t('accountmanagers.summary.notContacted'), value: totalNotContacted,
      color: totalNotContacted > 0 ? 'var(--color-warning)' : undefined,
      sub: compareMetrics ? <ReportCompareMetric metric={compareMetrics.not_contacted} polarity="down-good" /> : undefined,
    },
    // Spares (REPORTS-KPI-SPARE-2): two more "per manager" averages (mirrors
    // avgPerManager) and two rates over counts already summed above — all real
    // fields the endpoint already returns, no new backend field needed.
    avgOpportunitiesPerManager: { key: 'avgOpportunitiesPerManager', label: t('accountmanagers.summary.avgOpportunitiesPerManager'),
      value: managerCount > 0 ? formatNumber(Math.round((totalOpportunities / managerCount) * 10) / 10) : '—' },
    avgVacanciesPerManager: { key: 'avgVacanciesPerManager', label: t('accountmanagers.summary.avgVacanciesPerManager'),
      value: managerCount > 0 ? formatNumber(Math.round((totalOpenVacancies / managerCount) * 10) / 10) : '—' },
    notContactedRate: { key: 'notContactedRate', label: t('accountmanagers.summary.notContactedRate'),
      value: totalCustomers > 0 ? formatRatio(totalNotContacted / totalCustomers) : '—' },
    renewalsDueRate: { key: 'renewalsDueRate', label: t('accountmanagers.summary.renewalsDueRate'),
      value: totalCustomers > 0 ? formatRatio(totalContractEnding / totalCustomers) : '—' },
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

  const columns: Column<AccountManagerRow>[] = [
    { key: 'label', header: t('accountmanagers.cols.manager'), sortable: true, sortValue: r => r.label ?? '', render: r => r.label },
    { key: 'customers', header: t('accountmanagers.cols.customers'), align: 'right', sortable: true, sortValue: r => r.customers, render: r => numCell(r.customers) },
    { key: 'open_vacancies', header: t('accountmanagers.cols.openVacancies'), align: 'right', sortable: true, sortValue: r => r.open_vacancies, render: r => numCell(r.open_vacancies) },
    { key: 'filled_positions', header: t('accountmanagers.cols.filledPositions'), align: 'right', sortable: true, sortValue: r => r.filled_positions, render: r => numCell(r.filled_positions) },
    { key: 'opportunities', header: t('accountmanagers.cols.opportunities'), align: 'right', sortable: true, sortValue: r => r.opportunities, render: r => numCell(r.opportunities) },
    {
      key: 'contract_ending',
      header: <>{t('accountmanagers.cols.contractEnding')} <span style={{ fontWeight: 400, textTransform: 'none' }}>({t('accountmanagers.contractEndingHint', { days: data?.contract_ending_days ?? '—' })})</span></>,
      align: 'right', sortable: true, sortValue: r => r.contract_ending, render: r => attentionCell(r.contract_ending),
    },
    {
      key: 'not_contacted',
      header: <>{t('accountmanagers.cols.notContacted')} <span style={{ fontWeight: 400, textTransform: 'none' }}>({t('accountmanagers.notContactedHint', { days: data?.compliance_days ?? '—' })})</span></>,
      align: 'right', sortable: true, sortValue: r => r.not_contacted, render: r => attentionCell(r.not_contacted),
    },
  ]

  return (
    <div>
      {/* DELIBERATE EXCEPTION (REPORTS-THRESHOLD-OVERRIDE-1) — this is the ONLY report
          in the app with a threshold-override control. Why here: an account manager
          reads a dip in "not contacted" / "renewals due" and needs to tell apart "the
          PERIOD did this" from "the PERSON did this" — the override exists to answer
          that one question, nothing else. It is a VIEW-ONLY override: it never writes
          the tenant's customer_no_contact_days / customer_contract_ending_days
          Setting, only reshapes what this screen fetches (see accountManagersOverrideParams);
          leaving both fields blank always falls back to the tenant's own configured
          value, never a client-guessed default. ONE state object feeds BOTH comparison
          windows at once (the plain fetch above and the single compare call below) so
          the two halves can never end up measuring a different threshold.
          Do NOT copy this control onto another report "for consistency" — that is a
          decision, not a paste. Every other report just reads and displays whatever
          threshold the backend already applied server-side; adding an escape hatch
          elsewhere needs its own written reason (see this component's notes for which
          reports currently do that without one). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        <label style={overrideLabelStyle}>
          {t('accountmanagers.overrides.notContactedMonths')}
          <input type="number" min={1} max={60} value={months ?? ''}
            onChange={e => setMonths(e.target.value === '' ? undefined : Number(e.target.value))}
            style={inputStyle} />
        </label>
        <label style={overrideLabelStyle}>
          {t('accountmanagers.overrides.contractEndingDays')}
          <input type="number" min={1} max={365} value={contractEndingDays ?? ''}
            onChange={e => setContractEndingDays(e.target.value === '' ? undefined : Number(e.target.value))}
            style={inputStyle} />
        </label>
      </div>

      {/* RAPPORT-COMPARE-1: only rendered when the backend actually registered
          this slug — a report/view without compare support gets no control at
          all, never a disabled picker. */}
      {hasData && compareSlug && (
        <div style={{ marginBottom: 10 }}>
          <ReportCompareControl mode={compareMode} onChange={setCompareMode} />
        </div>
      )}

      {/* The scalar configuration echo — `.current` only, both windows measured
          against the SAME threshold by construction, so no delta is ever shown. */}
      {compareMode.kind !== 'off' && complianceCompare && contractEndingCompare && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          {t('accountmanagers.compareThresholds', {
            notContactedDays: complianceCompare.current,
            contractEndingDays: contractEndingCompare.current,
          })}
        </div>
      )}

      {/* KPI strip — above the table (candidate-page order: KPIs first) */}
      {hasData && (
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
            getRowId={r => r.key}
            loading={loading}
            loadingText={t('accountmanagers.loading')}
            emptyText={t('accountmanagers.empty')}
          />
        )}
      </ReportSectionCard>
    </div>
  )
}
