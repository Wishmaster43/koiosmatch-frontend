/**
 * UsagePerActivityTab (F5, "Per functie") — AI-tokens per activity code (own
 * GET /ai/koios/usage fetch; that endpoint has no prev_month support, so a
 * prev_month overview period falls back to month with an honest caption)
 * alongside the Koios Tokens workflow total already carried on the shared
 * /billing/usage payload (workflow.amount/total_credits, passed in as props —
 * that endpoint has no per-module split, only per-workflow, see
 * UsagePerWorkflowTab for the real module-level detail it does provide).
 * Activity codes are raw backend slugs — never rendered raw (§0.5) — translated
 * via billing.usage.activity.activityMap, falling back to the code itself.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useNumberFormat } from '@/lib/formatters'
import { SectionTitle, Mono } from '@/components/ui/typography'
import { card, sub, notice } from '../usageCardStyles'
import type { KoiosUsageResponse } from '@/types/billingUsage'
import type { BillingUsageWorkflow } from '@/types/billingUsage'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'

interface UsagePerActivityTabProps {
  // The /ai/koios/usage endpoint only accepts today|month (measured contract) —
  // a 'prev_month' overview period maps to 'month' here, with an honest caption.
  overviewPeriod: 'month' | 'prev_month'
  workflow: BillingUsageWorkflow | undefined
  workflowLoading: boolean
}

// Translate a raw activity code via the tenant-facing map, falling back to the
// raw code itself so an unmapped future code still renders something (§0.5).
function activityLabel(t: (k: string, o?: Record<string, unknown>) => string, code: string): string {
  return t(`billing.usage.activity.activityMap.${code}`, { defaultValue: code })
}

// AI-tokens-per-activity view (see the module doc above for the prev_month fallback and the split with the workflow-total endpoint).
export default function UsagePerActivityTab({ overviewPeriod, workflow, workflowLoading }: UsagePerActivityTabProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()

  const [ai, setAi] = useState<KoiosUsageResponse | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unavailable'>('loading')

  // AI usage per activity — the endpoint has no prev_month support, so any
  // overview period other than 'month' falls back to 'month' with a caption.
  const aiPeriod = overviewPeriod === 'prev_month' ? 'month' : overviewPeriod
  // Fetches the AI usage breakdown for the (possibly folded-back) period; a 403 reads as 'unavailable' (feature not entitled) rather than a generic error, and an empty-but-successful response reads as the empty state.
  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    api.get('/ai/koios/usage', { params: { period: aiPeriod }, signal: ctrl.signal })
      .then((res) => {
        const data = unwrap<KoiosUsageResponse>(res)
        setAi(data)
        setPhase((data?.totals?.calls ?? 0) > 0 ? 'ready' : 'empty')
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setPhase(err?.response?.status === 403 ? 'unavailable' : 'error')
      })
    return () => ctrl.abort()
  }, [aiPeriod])

  const aiColumns: Column<{ activity: string; calls?: number; input_tokens?: number; output_tokens?: number; amount?: number }>[] = [
    { key: 'activity', header: t('billing.usage.activity.colActivity'), render: (r) => activityLabel(t, r.activity) },
    { key: 'calls', header: t('billing.usage.activity.colCalls'), align: 'right', render: (r) => formatNumber(r.calls) },
    { key: 'tokens', header: t('billing.usage.activity.colTokens'), align: 'right', render: (r) => formatNumber((r.input_tokens ?? 0) + (r.output_tokens ?? 0)) },
    { key: 'amount', header: t('billing.usage.activity.colAmount'), align: 'right', render: (r) => formatCurrency(r.amount, ai?.totals?.currency) },
  ]

  return (
    <div>
      {overviewPeriod === 'prev_month' && (
        <p style={{ ...notice, marginBottom: 10 }}>{t('billing.usage.activity.periodCaption')}</p>
      )}

      <div style={card}>
        <SectionTitle style={{ marginBottom: 8 }}>{t('billing.usage.activity.aiSectionTitle')}</SectionTitle>
        {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
        {phase === 'error' && <p style={notice}>{t('billing.usage.activity.loadError')}</p>}
        {phase === 'unavailable' && <p style={notice}>{t('billing.usage.activity.unavailable')}</p>}
        {phase === 'empty' && <p style={notice}>{t('billing.usage.activity.empty')}</p>}
        {phase === 'ready' && (
          <DataTable columns={aiColumns} rows={ai?.per_activity ?? []} getRowId={(r) => r.activity}
            emptyText={t('billing.usage.activity.empty')} />
        )}
      </div>

      {/* Koios Tokens per module — the per-day workflow total, honestly labelled
          as one aggregate line: /billing/usage carries no per-module split, only
          per-workflow (see UsagePerWorkflowTab for the real module-level detail
          the backend does provide). */}
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.activity.workflowSectionTitle')}</SectionTitle>
        <div style={sub}>{t('billing.usage.activity.subtitle')}</div>
        {workflowLoading && <p style={notice}>{t('common.loadingShort')}</p>}
        {!workflowLoading && (workflow?.total_credits ?? 0) === 0 && <p style={notice}>{t('billing.usage.activity.empty')}</p>}
        {!workflowLoading && (workflow?.total_credits ?? 0) > 0 && (
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text)' }}>
            <span>{formatNumber(workflow?.total_credits)} {t('billing.usage.plan.workflowMeter')}</span>
            <Mono>{formatCurrency(workflow?.amount)}</Mono>
          </div>
        )}
      </div>
    </div>
  )
}
