/**
 * UsageOverviewSection (BILLING-USAGE-REDESIGN-1, F5 25-08 refactor) — the
 * "Overzicht" sub-tab body: KPI row, day/week bar chart with a click-to-drill
 * day detail card, and the day/week table.
 *
 * F5 (25-08): the /billing/usage fetch and the period right-panel filter both
 * moved UP to the GebruikSettings container — every sub-tab (Overzicht, Per
 * functie, Per workflow, Per gebruiker, WhatsApp) shares the SAME one period
 * control and the SAME one fetch, instead of each tab re-fetching and
 * re-registering its own copy. This component is now a pure presenter: `data`
 * and `phase` arrive as props.
 *
 * KRITIEK (§9 / margin secrecy, Danny 13-08): this endpoint never carries
 * purchase cost or margin — only sale `amount`/`credits`. Every subcomponent here
 * renders ONLY the keys documented on BillingUsageWorkflow/BillingUsageAi.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BillingUsageResponse } from '@/types/billingUsage'
import { mergeDailyRows } from './dailyUsageTypes'
import { aggregateToWeeks } from './weekAggregation'
import UsageKpiRow from './UsageKpiRow'
import UsageDayChart from './UsageDayChart'
import type { UsageCategory, UsageGranularity } from './UsageDayChart'
import UsageDrilldownCard from './UsageDrilldownCard'
import UsageDailyTable from './UsageDailyTable'
import { notice } from '../usageCardStyles'

interface WhatsAppUsage { cost?: { total?: number }; usage?: { waba_messages?: number }; currency?: string }

interface UsageOverviewSectionProps {
  data: BillingUsageResponse['data'] | undefined
  phase: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'
  // Subscription-meter drill (Danny 24-08): switches the chart to that meter's
  // series and scrolls it into view; nonce distinguishes repeated clicks.
  drillRequest?: { category: 'workflow' | 'ai'; nonce: number } | null
  wa: WhatsAppUsage | null
  waLoading: boolean
}

export default function UsageOverviewSection({ data, phase, drillRequest, wa, waLoading }: UsageOverviewSectionProps) {
  const { t } = useTranslation('settings')

  const [category, setCategory] = useState<UsageCategory>('total')
  const chartRef = useRef<HTMLDivElement | null>(null)
  // Apply a meter drill: pick the series and bring the chart into view.
  useEffect(() => {
    if (!drillRequest) return
    setCategory(drillRequest.category)
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Keyed on the nonce alone on purpose: the request object is rebuilt per
    // click and category rides inside it — depending on the object would refire
    // on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillRequest?.nonce])
  const [granularity, setGranularity] = useState<UsageGranularity>('day')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const rows = useMemo(() => mergeDailyRows(data), [data])
  const weekRows = useMemo(() => aggregateToWeeks(rows), [rows])
  const selectedRow = useMemo(() => rows.find(r => r.date === selectedDate) ?? null, [rows, selectedDate])

  return (
    <div>
      <UsageKpiRow billing={data} billingLoading={phase === 'loading'} wa={wa} waLoading={waLoading} />

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.daily.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.credits.unavailable')}</p>}
      {phase === 'empty' && <p style={notice}>{t('billing.usage.daily.empty')}</p>}

      {phase === 'ready' && (
        <>
          <div ref={chartRef}>
          <UsageDayChart
            rows={rows} weekRows={weekRows}
            category={category} onCategoryChange={setCategory}
            granularity={granularity}
            onGranularityChange={(g) => {
              // A week has no single day: an open day drill-down must not float
              // above a week table (Opus minor) — close it on the switch.
              setGranularity(g)
              if (g === 'week') setSelectedDate(null)
            }}
            onSelectDate={setSelectedDate}
          />
          </div>

          {selectedRow && <UsageDrilldownCard row={selectedRow} onClose={() => setSelectedDate(null)} />}

          <UsageDailyTable
            granularity={granularity}
            dayRows={rows}
            weekRows={weekRows}
            onSelectDate={setSelectedDate}
          />
        </>
      )}
    </div>
  )
}
