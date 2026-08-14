/**
 * UsageDailySection (USAGE-DAILY-1) — the tenant's own day-by-day usage, chart +
 * table + right-panel filters (Danny 14-08: "grafiek rechts ernaast, niet alleen
 * grafiek maar ook tabel en dan rechts filters"). Source: the SAME GET /billing/usage
 * endpoint CreditsUsageCard already uses (own fetch, own period state) — its
 * `data.workflow.per_day` and `data.ai.per_day` arrays are REAL per-day series
 * (BillingUsageController::workflowUsage/aiUsage), so this is not the fabricated
 * "coming soon" placeholder GebruikSettings used to render here.
 *
 * KRITIEK (§9 / margin secrecy, Danny 13-08 "Inkoop moet ik zien onder superadmin
 * niemand mag hier bij"): /billing/usage never carries purchase cost or margin at
 * any level (see BillingUsageController's own header comment) — only sale
 * `amount`/`credits`. This component renders ONLY the keys documented on
 * BillingUsageWorkflow/BillingUsageAi; it never reads a `cost`/`margin` field even
 * defensively, so a future payload change could not silently leak one through here.
 *
 * Category filter is REAL, not the four-way Total/AI/Leads/Phone-calls/WhatsApp
 * from the reference screenshot — only Workflow and AI have a day×amount series in
 * the backend today. Leads/Phone calls don't exist as a usage category at all yet;
 * WhatsApp usage (`/settings/messaging-costs`) has no `from`/`to`/per-day support,
 * only a "this month" total (see GebruikSettings' own WhatsApp card). Offering
 * those as chart categories would draw a fabricated line (§3 no fake affordances) —
 * see the exact backend ask in this ticket's handoff notes.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import { useRightPanel } from '@/context/RightPanelContext'
import type { FilterGroup } from '@/context/RightPanelContext'
import DataTable from '@/components/ui/DataTable'
import SegmentedControl from '@/components/ui/SegmentedControl'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import type { BillingUsageResponse } from '@/types/billingUsage'
import { card, cardTitle, sub, notice } from './usageCardStyles'

type Category = 'total' | 'workflow' | 'ai'

// One merged day row — workflow (credits/amount) + ai (tokens/amount), the same
// merge BillingUsageController::mergedPerDayRows does server-side for the xlsx
// export, done client-side here since the JSON endpoint returns the two series
// separately. Dates with activity on only one side still render (zero-filled).
interface DailyRow {
  date: string
  workflowCredits: number
  workflowAmount: number
  aiInputTokens: number
  aiOutputTokens: number
  aiAmount: number
  totalAmount: number
}

// Merge the two per-day arrays keyed by date, computing each day's workflow
// amount from credits × credit_price (the endpoint only sends the amount total,
// not a per-day amount, for workflow — mirrors the backend export merge).
function mergeDailyRows(data: BillingUsageResponse['data'] | undefined): DailyRow[] {
  const creditPrice = data?.workflow?.credit_price ?? 0
  const byDate = new Map<string, DailyRow>()
  for (const row of data?.workflow?.per_day ?? []) {
    const credits = row.credits ?? 0
    byDate.set(row.date, {
      date: row.date, workflowCredits: credits, workflowAmount: Math.round(credits * creditPrice * 100) / 100,
      aiInputTokens: 0, aiOutputTokens: 0, aiAmount: 0, totalAmount: 0,
    })
  }
  for (const row of data?.ai?.per_day ?? []) {
    const existing = byDate.get(row.date) ?? {
      date: row.date, workflowCredits: 0, workflowAmount: 0, aiInputTokens: 0, aiOutputTokens: 0, aiAmount: 0, totalAmount: 0,
    }
    existing.aiInputTokens = row.input_tokens ?? 0
    existing.aiOutputTokens = row.output_tokens ?? 0
    existing.aiAmount = row.amount ?? 0
    byDate.set(row.date, existing)
  }
  const rows = Array.from(byDate.values()).map(r => ({ ...r, totalAmount: Math.round((r.workflowAmount + r.aiAmount) * 100) / 100 }))
  rows.sort((a, b) => a.date.localeCompare(b.date))
  return rows
}

export default function UsageDailySection() {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const { formatDate } = useDateFormat()
  const { registerFilters, unregisterFilters } = useRightPanel()

  const [period, setPeriod] = useState<'month' | 'prev_month'>('month')
  const [category, setCategory] = useState<Category>('total')
  const [data, setData] = useState<BillingUsageResponse['data'] | undefined>(undefined)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  // Own fetch (this section can outlive the rest of the page's cards, mirrors
  // CreditsUsageCard's own-fetch convention) — refetches on period change.
  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    api.get('/billing/usage', { params: { period }, signal: ctrl.signal })
      .then((res) => {
        const body = unwrap<BillingUsageResponse['data']>(res)
        setData(body)
        const hasActivity = (body?.workflow?.total_credits ?? 0) > 0
          || (body?.ai?.input_tokens ?? 0) > 0 || (body?.ai?.output_tokens ?? 0) > 0
        setPhase(hasActivity ? 'ready' : 'empty')
      })
      .catch(() => setPhase('error'))
    return () => ctrl.abort()
  }, [period])

  const rows = useMemo(() => mergeDailyRows(data), [data])

  // Right-panel registration — period + category, the shared mechanism every
  // other page registers filters through (§3A). `noChip` on period mirrors the
  // reports page: it is always-on, nothing honest to "remove" it to.
  useEffect(() => {
    const groups: FilterGroup[] = [
      {
        key: 'usage-daily-period', label: t('billing.usage.daily.periodLabel'), type: 'radio', noChip: true,
        selected: [period], onToggle: (v: string | number) => setPeriod(String(v) as 'month' | 'prev_month'),
        options: [
          { value: 'month', label: t('billing.usage.periodMonth') },
          { value: 'prev_month', label: t('billing.usage.credits.periodPrevMonth') },
        ],
      },
      {
        key: 'usage-daily-category', label: t('billing.usage.daily.categoryLabel'), type: 'radio', noChip: true,
        selected: [category], onToggle: (v: string | number) => setCategory(String(v) as Category),
        options: [
          { value: 'total', label: t('billing.usage.daily.categoryTotal') },
          { value: 'workflow', label: t('billing.usage.daily.categoryWorkflow') },
          { value: 'ai', label: t('billing.usage.daily.categoryAi') },
        ],
      },
    ]
    registerFilters('usage-daily-section', groups)
    return () => unregisterFilters('usage-daily-section')
  }, [t, period, category, registerFilters, unregisterFilters])

  // Chart series follows the same category so the bar chart above the table
  // always matches what the segmented control (mobile-friendly duplicate of the
  // right-panel radio, mirrors TenantUsageBreakdownTable's own axis control)
  // says is selected — the right panel drives the same `category` state.
  const chartData = useMemo(() => rows.map(r => ({
    name: formatDate(r.date),
    key: r.date,
    value: r.totalAmount,
    workflow: r.workflowAmount,
    ai: r.aiAmount,
    total: r.totalAmount,
  })), [rows, formatDate])

  const chartSeries = useMemo(() => {
    if (category === 'workflow') return [{ key: 'workflow', label: t('billing.usage.daily.categoryWorkflow'), color: 'var(--color-primary)' }]
    if (category === 'ai') return [{ key: 'ai', label: t('billing.usage.daily.categoryAi'), color: 'var(--color-info, var(--color-primary))' }]
    return [{ key: 'total', label: t('billing.usage.daily.categoryTotal'), color: 'var(--color-primary)' }]
  }, [category, t])

  const columns = [
    { key: 'date', header: t('billing.usage.daily.colDate'), render: (r: DailyRow) => formatDate(r.date) },
    { key: 'workflowCredits', header: t('billing.usage.daily.colWorkflowCredits'), align: 'right' as const, render: (r: DailyRow) => formatNumber(r.workflowCredits) },
    { key: 'workflowAmount', header: t('billing.usage.daily.colWorkflowAmount'), align: 'right' as const, render: (r: DailyRow) => formatCurrency(r.workflowAmount) },
    { key: 'aiTokens', header: t('billing.usage.daily.colAiTokens'), align: 'right' as const, render: (r: DailyRow) => formatNumber(r.aiInputTokens + r.aiOutputTokens) },
    { key: 'aiAmount', header: t('billing.usage.daily.colAiAmount'), align: 'right' as const, render: (r: DailyRow) => formatCurrency(r.aiAmount) },
    { key: 'totalAmount', header: t('billing.usage.daily.colTotalAmount'), align: 'right' as const, render: (r: DailyRow) => formatCurrency(r.totalAmount) },
  ]

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={cardTitle}>{t('billing.usage.daily.title')}</div>
          <div style={sub}>{t('billing.usage.daily.subtitle')}</div>
        </div>
        <SegmentedControl
          size="compact"
          ariaLabel={t('billing.usage.daily.categoryLabel')}
          options={[
            { value: 'total', label: t('billing.usage.daily.categoryTotal') },
            { value: 'workflow', label: t('billing.usage.daily.categoryWorkflow') },
            { value: 'ai', label: t('billing.usage.daily.categoryAi') },
          ]}
          value={category}
          onChange={(v) => setCategory(v as Category)}
        />
      </div>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.daily.loadError')}</p>}
      {phase === 'empty' && <p style={notice}>{t('billing.usage.daily.empty')}</p>}

      {phase === 'ready' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <WeeklyBarChartCard data={chartData} series={chartSeries} height={220} />
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(r: DailyRow) => r.date}
            emptyText={t('billing.usage.daily.empty')}
          />
        </>
      )}
    </div>
  )
}
