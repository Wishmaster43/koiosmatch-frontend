/**
 * BillingUsageSettings (F5, BILLING-USAGE-REDESIGN-2 — one vocabulary, sub-tabs, one
 * period control, drill-downs, WhatsApp per channel) — Danny 25-08: "Koios AI en
 * Tokens en Koios AI-tokens? Waar komt het verbruik nu vandaan? Lijst is erg
 * lang, subtabjes en drill down". Gated on `billing.view` (SettingsPage registry).
 *
 * ONE fetch (GET /billing/usage?period=month|prev_month), ONE period control
 * (right panel, radio — the only real filter, §4 "EVERY filter lives in the
 * right-hand filter panel"), five sub-tabs sharing the same period:
 *   - Overzicht:    SubscriptionCard (meters) + UsageOverviewSection (KPI/chart/
 *                    table) + UsageInvoiceCard ("Factuurvoorschot").
 *   - Per functie:  AI-tokens per activity (own /ai/koios/usage fetch, no
 *                    prev_month support — honest caption) + Koios Tokens total.
 *   - Per workflow: workflow.per_workflow, row click → the workflow editor.
 *   - Per gebruiker:ai.per_user.
 *   - WhatsApp:     whatsapp.by_channel when present, else the legacy
 *                    messaging-costs by_number card (own component fetch).
 *
 * ONE vocabulary everywhere (settings.json billing.usage.*): "Koios Tokens" =
 * workflow executions, "AI-tokens" = Claude tokens, "WhatsApp Tokens" = wa_web
 * messages (§0.11 — never call the workflow unit anything else). The old
 * "Koios AI-facturatie" card (GET /ai/koios/usage/billing?month=) is dropped —
 * see UsageInvoiceCard's header comment for why it doesn't come back as a
 * fourth source. The native month input and the inline QuickViewToggle period
 * toggles are removed (§3A blueprint / §4 "no filter outside the right panel").
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSpreadsheet } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useRightPanel } from '@/context/RightPanelContext'
import type { FilterGroup } from '@/context/RightPanelContext'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import SubTabBar from '@/components/drawer/SubTabBar'
import { PageTitle } from '@/components/ui/typography'
import type { BillingUsageResponse } from '@/types/billingUsage'
import SubscriptionCard from './usage/SubscriptionCard'
import UsageOverviewSection from './usage/UsageOverviewSection'
import UsageInvoiceCard from './usage/UsageInvoiceCard'
import UsagePerActivityTab from './usage/UsagePerActivityTab'
import UsagePerWorkflowTab from './usage/UsagePerWorkflowTab'
import UsagePerUserTab from './usage/UsagePerUserTab'
import UsageWhatsAppTab from './usage/UsageWhatsAppTab'

type Period = 'month' | 'prev_month'
type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'
type Tab = 'overview' | 'activity' | 'workflow' | 'user' | 'whatsapp'

interface WhatsAppUsage { cost?: { total?: number }; usage?: { waba_messages?: number }; currency?: string }

// EXCEL-1 — stream the usage xlsx (per day / per workflow / per user tabs, sale
// prices only, §9) to disk via a temporary object URL, never a bare <a href>.
async function downloadUsageXlsx(period: Period) {
  const res = await api.get('/billing/usage/export', { params: { period }, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `usage-${period}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Settings → Billing → Usage: owns the one shared /billing/usage fetch and period
// filter that every sub-tab reads, so switching tabs never triggers its own refetch.
export default function BillingUsageSettings() {
  const { t } = useTranslation('settings')
  const { registerFilters, unregisterFilters } = useRightPanel()

  const [tab, setTab] = useState<Tab>('overview')

  // ONE period control for every sub-tab — the real filter (§4).
  const [period, setPeriod] = useState<Period>('month')

  // ONE /billing/usage fetch, shared by every sub-tab (§ container comment).
  const [data, setData] = useState<BillingUsageResponse['data'] | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>('loading')

  // Fetch usage for the selected period; aborting on a period switch avoids a stale
  // response landing after a newer one, and 'empty' vs 'ready' is derived from whether anything was actually used.
  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    api.get('/billing/usage', { params: { period }, signal: ctrl.signal })
      .then((res) => {
        const body = unwrap<BillingUsageResponse['data']>(res)
        setData(body)
        const hasWhatsappActivity = (body?.whatsapp?.by_channel ?? []).some((c) => (c.messages ?? 0) > 0)
        const hasActivity = (body?.workflow?.total_credits ?? 0) > 0
          || (body?.ai?.input_tokens ?? 0) > 0 || (body?.ai?.output_tokens ?? 0) > 0
          || hasWhatsappActivity
        setPhase(hasActivity ? 'ready' : 'empty')
      })
      .catch((err) => {
        // An ABORTED request is not a failure (fires on every period switch).
        if (ctrl.signal.aborted) return
        setPhase(err?.response?.status === 403 ? 'unavailable' : 'error')
      })
    return () => ctrl.abort()
  }, [period])

  // Legacy WhatsApp KPI-tile fetch — kept for the Overzicht KPI row and the
  // WhatsApp tab's fallback (month-only, no period param, §see UsageWhatsAppTab).
  const [wa, setWa] = useState<WhatsAppUsage | null>(null)
  const [waPhase, setWaPhase] = useState<Phase>('loading')
  // One-time legacy WhatsApp KPI fetch (month-only, no period param) for the overview tile and the WhatsApp tab's fallback.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/settings/messaging-costs', { signal: ctrl.signal })
      .then((res) => {
        const d = unwrap<WhatsAppUsage>(res)
        setWa(d)
        setWaPhase((d?.usage?.waba_messages ?? 0) > 0 ? 'ready' : 'empty')
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setWaPhase(err?.response?.status === 403 ? 'unavailable' : 'error')
      })
    return () => ctrl.abort()
  }, [])

  // Meter drill from the subscription card into the daily chart (Danny 24-08).
  const [meterDrill, setMeterDrill] = useState<{ category: 'workflow' | 'ai'; nonce: number } | null>(null)

  // Only `period` registers in the right panel — the real filter (§4).
  useEffect(() => {
    const groups: FilterGroup[] = [{
      key: 'usage-period', label: t('billing.usage.daily.periodLabel'), type: 'radio', noChip: true,
      selected: [period], onToggle: (v: string | number) => setPeriod(String(v) as Period),
      options: [
        { value: 'month', label: t('billing.usage.periodMonth') },
        { value: 'prev_month', label: t('billing.usage.credits.periodPrevMonth') },
      ],
    }]
    registerFilters('usage-page', groups)
    return () => unregisterFilters('usage-page')
  }, [t, period, registerFilters, unregisterFilters])

  const [exporting, setExporting] = useState(false)
  // Download the usage export for the current period, surfacing a mapped error message on failure.
  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadUsageXlsx(period)
    } catch (err) {
      notifyError(extractApiError(err, t('billing.usage.exportFailed')))
    } finally {
      setExporting(false)
    }
  }

  const tabs = [
    { id: 'overview', label: t('billing.usage.tabs.overview') },
    { id: 'activity', label: t('billing.usage.tabs.activity') },
    { id: 'workflow', label: t('billing.usage.tabs.workflow') },
    { id: 'user', label: t('billing.usage.tabs.user') },
    { id: 'whatsapp', label: t('billing.usage.tabs.whatsapp') },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <PageTitle>{t('billing.usage.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('billing.usage.desc')}</p>
        </div>
        {/* EXCEL-1 — xlsx export of the current period's usage. */}
        <Button variant="secondary" onClick={handleExport} disabled={exporting}
          title={t('billing.usage.exportXlsx')}>
          {exporting ? <Spinner size={13} /> : <FileSpreadsheet size={13} aria-hidden="true" />}
          {t('billing.usage.exportXlsx')}
        </Button>
      </div>

      <SubTabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />
      <div style={{ marginTop: 14 }}>
        {tab === 'overview' && (
          <>
            <SubscriptionCard subscription={data?.subscription ?? null} phase={phase}
              onDrillAi={() => setMeterDrill({ category: 'ai', nonce: Date.now() })}
              onDrillWorkflow={() => setMeterDrill({ category: 'workflow', nonce: Date.now() })} />
            <UsageOverviewSection data={data} phase={phase} drillRequest={meterDrill}
              wa={wa} waLoading={waPhase === 'loading'} />
            <UsageInvoiceCard data={data} phase={phase} />
          </>
        )}
        {tab === 'activity' && (
          <UsagePerActivityTab overviewPeriod={period} workflow={data?.workflow} workflowLoading={phase === 'loading'} />
        )}
        {tab === 'workflow' && <UsagePerWorkflowTab workflow={data?.workflow} phase={phase} />}
        {tab === 'user' && <UsagePerUserTab ai={data?.ai} phase={phase} />}
        {tab === 'whatsapp' && <UsageWhatsAppTab whatsapp={data?.whatsapp} />}
      </div>
    </div>
  )
}
