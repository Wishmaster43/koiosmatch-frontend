/**
 * LeadsReport — leads-only slice of the candidate inflow (REPORTS-LEADS-1).
 * Leads are candidates whose Phase axis is 'lead' (§3B: Phase is the lifecycle
 * axis, seeded Lead → Candidate). There is no dedicated `/reports/leads`
 * endpoint — this report reuses the EXISTING `GET /reports/candidates` call
 * (`useCandidatesReport`, already fetched by CandidatesReport) and reads the
 * one real number it carries for this population: the 'lead' segment on
 * `by_phase`. It deliberately does NOT reuse `by_status`/`by_source`/`by_owner`/
 * `by_branch` as if they were "leads broken down" — those axes count ALL
 * candidates in the window, not leads only, and relabelling them here would be
 * exactly the "number that isn't what its label says" mistake (house rule).
 * Until a lead-scoped endpoint exists (see the KPI dashes below), this page
 * honestly shows one real card and eight dashes rather than a page of
 * fabricated zeros — see reportIds.ts / WORKLIST for the backend ask.
 */
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useCandidatesReport } from './useCandidatesReport'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

export default function LeadsReport({ period, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useCandidatesReport(period, filters)

  // The one real number this page has: the 'lead' segment of the Phase axis
  // already on the candidates report payload. Not a new endpoint, not a guess.
  const leadSegment = data?.by_phase.find(s => s.value === 'lead')
  const totalLeads = leadSegment?.count ?? null
  const isEmpty = !loading && !error && (data == null || totalLeads == null || totalLeads === 0)
  const hasData = !loading && !error && data != null && !isEmpty

  // Nine slots, always. Only "Total leads" is a real, traceable number; the
  // other eight need axes/endpoints that don't exist yet for a leads-only
  // population (a leads-scoped source/owner/branch/conversion breakdown) —
  // they render the house dash rather than borrowing the whole-population
  // numbers under a leads label.
  const kpiByKey: Record<string, KpiSpec> = {
    totalLeads: { key: 'totalLeads', label: t('leads.summary.totalLeads'), value: totalLeads ?? '—' },
    bySource: { key: 'bySource', label: t('leads.summary.bySource'), value: '—' },
    byOwner: { key: 'byOwner', label: t('leads.summary.byOwner'), value: '—' },
    byBranch: { key: 'byBranch', label: t('leads.summary.byBranch'), value: '—' },
    converted: { key: 'converted', label: t('leads.summary.converted'), value: '—' },
    conversionRate: { key: 'conversionRate', label: t('leads.summary.conversionRate'), value: '—' },
    avgTimeToConvert: { key: 'avgTimeToConvert', label: t('leads.summary.avgTimeToConvert'), value: '—' },
    staleLeads: { key: 'staleLeads', label: t('leads.summary.staleLeads'), value: '—' },
    newThisPeriod: { key: 'newThisPeriod', label: t('leads.summary.newThisPeriod'), value: totalLeads != null ? totalLeads : '—' },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('leads').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('leads')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('leads'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {hasData && <ReportKpiBand kpis={kpis} notice={fellBack ? t('leads.kpiOrderFellBack') : undefined} />}

      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('leads.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={isEmpty}
          loadingLabel={t('leads.loading')} errorLabel={t('leads.error')} emptyLabel={t('leads.empty')}
          onRetry={() => refetch()}
        />
        {hasData && (
          <div style={{ padding: 20 }}>
            {/* Honest partial-data notice — the only source of truth is a single
                axis segment; explain why the other eight cards are dashes rather
                than let the reader assume nothing was built. */}
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {t('leads.partialNotice')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
