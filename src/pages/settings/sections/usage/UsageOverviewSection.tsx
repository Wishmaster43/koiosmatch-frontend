/**
 * UsageOverviewSection (BILLING-USAGE-REDESIGN-1) — the redesigned top of
 * billing_usage: KPI row, day/week bar chart with a click-to-drill-down day
 * detail card, and the day/week table. Replaces the old CreditsUsageCard +
 * UsageDailySection pair (their combined `/billing/usage` period data now feeds
 * one coherent block instead of two separate cards repeating the same numbers —
 * Danny 23-08: "duidelijk ... per dag per week per maand terug kan zien").
 *
 * Source: GET /billing/usage?period=month|prev_month (workflow.total_credits,
 * workflow.credit_price, workflow.amount, workflow.per_day[], ai.input_tokens,
 * ai.output_tokens, ai.amount, ai.per_day[]) + GET /settings/messaging-costs
 * (month-only, no period param — feeds only the WhatsApp KPI tile, see
 * UsageKpiRow's header comment for why it can't join the chart/table).
 *
 * KRITIEK (§9 / margin secrecy, Danny 13-08): this endpoint never carries
 * purchase cost or margin — only sale `amount`/`credits`. Every subcomponent here
 * renders ONLY the keys documented on BillingUsageWorkflow/BillingUsageAi.
 *
 * `wa`/`waLoading` arrive as PROPS, not an own fetch: GebruikSettings already
 * fetches /settings/messaging-costs for its own WhatsApp table block — passing
 * it down avoids firing the same request twice per page load.
 *
 * Right-panel filter: ONLY `period` registers there now (the real filter — it
 * changes what is fetched). `category`/`granularity` are VIEW choices of the
 * chart/table on this page (which series show, which rollup) and live as inline
 * SegmentedControls only — registering them too would be the exact duplicate
 * surface Danny flagged on the matches page (§4 "EVERY filter lives in the
 * right-hand filter panel"); they change no request, so they don't belong there.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useRightPanel } from '@/context/RightPanelContext'
import type { FilterGroup } from '@/context/RightPanelContext'
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
  // Billing period is OWNED by GebruikSettings (the xlsx export must follow it);
  // this section only renders it and registers it in the right panel.
  period: 'month' | 'prev_month'
  onPeriodChange: (p: 'month' | 'prev_month') => void
  // Subscription-meter drill (Danny 24-08): switches the chart to that meter's
  // series and scrolls it into view; nonce distinguishes repeated clicks.
  drillRequest?: { category: 'workflow' | 'ai'; nonce: number } | null
  wa: WhatsAppUsage | null
  waLoading: boolean
  // CREDITS-2-FE deel 1 — lifts data.subscription out of this section's own
  // /billing/usage fetch so GebruikSettings can render SubscriptionCard from
  // it without a second request. Fires with the same phase this section uses.
  onSubscriptionChange?: (subscription: BillingUsageResponse['data']['subscription'] | null, phase: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable') => void
}

export default function UsageOverviewSection({ period, onPeriodChange, drillRequest, wa, waLoading, onSubscriptionChange }: UsageOverviewSectionProps) {
  const { t } = useTranslation('settings')
  const { registerFilters, unregisterFilters } = useRightPanel()

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

  const [data, setData] = useState<BillingUsageResponse['data'] | undefined>(undefined)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unavailable'>('loading')

  // Main usage fetch — refetches on period change; abort-guarded (§9 perf).
  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    onSubscriptionChange?.(null, 'loading')
    api.get('/billing/usage', { params: { period }, signal: ctrl.signal })
      .then((res) => {
        const body = unwrap<BillingUsageResponse['data']>(res)
        setData(body)
        const hasActivity = (body?.workflow?.total_credits ?? 0) > 0
          || (body?.ai?.input_tokens ?? 0) > 0 || (body?.ai?.output_tokens ?? 0) > 0
        const nextPhase = hasActivity ? 'ready' : 'empty'
        setPhase(nextPhase)
        onSubscriptionChange?.(body?.subscription ?? null, nextPhase)
      })
      .catch((err) => {
        // An ABORTED request is not a failure: the cleanup fires on every period
        // switch and its rejection lands after the next effect already set
        // 'loading' — writing 'error' there painted a false failure over a
        // normally-loading screen (Opus, reproduced). 403 keeps its own honest
        // state (defence in depth under the registry's billing.view gate).
        if (ctrl.signal.aborted) return
        const nextPhase = (err as { response?: { status?: number } })?.response?.status === 403 ? 'unavailable' : 'error'
        setPhase(nextPhase)
        onSubscriptionChange?.(null, nextPhase)
      })
    return () => ctrl.abort()
  }, [period, onSubscriptionChange])

  const rows = useMemo(() => mergeDailyRows(data), [data])
  const weekRows = useMemo(() => aggregateToWeeks(rows), [rows])
  const selectedRow = useMemo(() => rows.find(r => r.date === selectedDate) ?? null, [rows, selectedDate])

  // Only `period` — the real filter — registers in the right panel (see header comment).
  useEffect(() => {
    const groups: FilterGroup[] = [{
      key: 'usage-overview-period', label: t('billing.usage.daily.periodLabel'), type: 'radio', noChip: true,
      selected: [period], onToggle: (v: string | number) => onPeriodChange(String(v) as 'month' | 'prev_month'),
      options: [
        { value: 'month', label: t('billing.usage.periodMonth') },
        { value: 'prev_month', label: t('billing.usage.credits.periodPrevMonth') },
      ],
    }]
    registerFilters('usage-overview-section', groups)
    return () => unregisterFilters('usage-overview-section')
  }, [t, period, onPeriodChange, registerFilters, unregisterFilters])

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
