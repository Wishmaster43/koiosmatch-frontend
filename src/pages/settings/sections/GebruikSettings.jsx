/**
 * GebruikSettings (billing_usage, BILLING-USAGE-REDESIGN-1, was USAGE-LIMITS-1 +
 * CREDITS-1) — cross-domain usage & limits overview. Gated on the `billing.view`
 * permission at the registry level (SettingsPage) — settings.view alone never
 * surfaces this screen (§3). Thin container; the real work lives in its
 * subcomponents, all REAL data verified against koiosmatch-api:
 *   - Usage overview (KPI row + day/week chart + drill-down + table), own folder
 *     `usage/` — GET /billing/usage?period=month|prev_month (workflow+AI, sale-
 *     price, per-day series) + GET /settings/messaging-costs (WhatsApp KPI tile
 *     only, month-only). See usage/UsageOverviewSection.tsx for the full contract.
 *   - AI usage (Koios) per-activity table — GET /ai/koios/usage?period=today|month
 *   - WhatsApp usage table — GET /settings/messaging-costs (always "this month")
 *   - Koios AI billing   — GET /ai/koios/usage/billing?month=YYYY-MM (K0, invoice-
 *     ready Claude + workflow-token totals; see the block below for detail)
 * CREDITS-1 §9-reparatie: the AI usage/billing shapes are SALE-PRICE only now
 * (totals.amount, per_activity[].amount, billable_cost) — claude.cost/margin_pct
 * are gone from the billing endpoint; never render a purchase price here, that
 * inkoop view lives on the superadmin tenant-usage screen only.
 * One piece of the reference screenshot has NO backend behind it at all yet —
 * current plan + credit progress bar + reset date + credit balance need a
 * plan/credit model that does not exist (Tenant only has package/add-on gating,
 * no credits ledger). Renders as a calm "not built yet" notice instead of fake
 * numbers (§3 — no fake affordances). Auto top-up is intentionally NOT built
 * here — it was deliberately dropped (billing_pay, R-1) and needs Danny's
 * confirmation before it comes back (see WORKLIST USAGE-LIMITS-1).
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useNumberFormat } from '@/lib/formatters'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import Spinner from '@/components/ui/Spinner'
import { card, sub, th, td, numCell, notice, Tile } from './usageCardStyles'
import UsageOverviewSection from './usage/UsageOverviewSection'
import SubscriptionCard from './usage/SubscriptionCard'
import Button from '@/components/ui/Button'
import { PageTitle, SectionTitle, Caption } from '@/components/ui/typography'

// EXCEL-1 — stream the usage xlsx (per day / per workflow / per user tabs, sale
// prices only, §9) to disk via a temporary object URL, never a bare <a href>.
async function downloadUsageXlsx(period) {
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

// Current month as 'YYYY-MM' — the default billing period shown on first load
// (matches the `month` query param the K0 billing endpoint expects).
function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function GebruikSettings() {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  // Period toggle — matches the AI usage endpoint's own `period` param exactly.
  const [period, setPeriod] = useState('month')

  // CREDITS-2-FE deel 1 — subscription snapshot lifted out of UsageOverviewSection's
  // own /billing/usage fetch (no second request), rendered in SubscriptionCard.
  const [subscription, setSubscription] = useState(null)
  const [subscriptionPhase, setSubscriptionPhase] = useState('loading')
  const handleSubscriptionChange = useCallback((sub, phase) => {
    setSubscription(sub)
    setSubscriptionPhase(phase)
  }, [])

  const [ai, setAi] = useState(null)
  const [aiPhase, setAiPhase] = useState('loading') // loading | ready | empty | error | unavailable
  const [wa, setWa] = useState(null)
  const [waPhase, setWaPhase] = useState('loading')

  // Koios AI billing (K0) — month picker + invoice-ready Claude/workflow totals.
  const [month, setMonth] = useState(currentMonthKey)
  const [billing, setBilling] = useState(null)
  const [billingPhase, setBillingPhase] = useState('loading')
  // The per-module run breakdown is collapsed by default — clicking the workflow
  // line reveals it (the "explain the invoice" story from the K0 handoff).
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  // AI usage (Koios) — refetches whenever the period toggle changes; a 403 means
  // the tenant doesn't have the koios_ai module (calm "unavailable", not an error).
  useEffect(() => {
    let alive = true
    setAiPhase('loading')
    api.get('/ai/koios/usage', { params: { period } })
      .then((res) => {
        if (!alive) return
        const data = unwrap(res)
        setAi(data)
        setAiPhase((data?.totals?.calls ?? 0) > 0 ? 'ready' : 'empty')
      })
      .catch((err) => { if (alive) setAiPhase(err?.response?.status === 403 ? 'unavailable' : 'error') })
    return () => { alive = false }
  }, [period])

  // WhatsApp/messaging usage — the report endpoint has no period param (always
  // "this month"); a 403 means the user lacks settings.update.
  useEffect(() => {
    let alive = true
    api.get('/settings/messaging-costs')
      .then((res) => {
        if (!alive) return
        const data = unwrap(res)
        setWa(data)
        setWaPhase((data?.usage?.waba_messages ?? 0) > 0 ? 'ready' : 'empty')
      })
      .catch((err) => { if (alive) setWaPhase(err?.response?.status === 403 ? 'unavailable' : 'error') })
    return () => { alive = false }
  }, [])

  // Koios AI billing (K0) — refetches whenever the month picker changes; a 403
  // means the user lacks permission to view it (same convention as WhatsApp usage).
  useEffect(() => {
    let alive = true
    setBillingPhase('loading')
    api.get('/ai/koios/usage/billing', { params: { month } })
      .then((res) => {
        if (!alive) return
        const data = unwrap(res)
        setBilling(data)
        const hasActivity = (data?.workflow?.total_module_runs ?? 0) > 0
          || (data?.claude?.tokens_in ?? 0) > 0 || (data?.claude?.tokens_out ?? 0) > 0
        setBillingPhase(hasActivity ? 'ready' : 'empty')
      })
      .catch((err) => { if (alive) setBillingPhase(err?.response?.status === 403 ? 'unavailable' : 'error') })
    return () => { alive = false }
  }, [month])

  // Billing period lives HERE (not in UsageOverviewSection) so the xlsx export
  // always follows the period the user picked in the right panel — it used to
  // send the AI block's today|month state to a month|prev_month contract (Opus).
  const [billingPeriod, setBillingPeriod] = useState('month')
  // Meter drill from the subscription card into the daily chart (Danny 24-08).
  const [meterDrill, setMeterDrill] = useState(null)
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadUsageXlsx(billingPeriod)
    } catch (err) {
      notifyError(extractApiError(err, t('billing.usage.exportFailed')))
    } finally {
      setExporting(false)
    }
  }

  return (
    // Full width (Danny 23-08: "waarom zo smal, kijk hoeveel ruimte je nog hebt") —
    // the chart/table block earns the room; the settings shell provides the padding.
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

      {/* CREDITS-2-FE deel 1 — real package/budget snapshot, fed by the fetch below. */}
      <SubscriptionCard subscription={subscription} phase={subscriptionPhase}
        onDrillAi={() => setMeterDrill({ category: 'ai', nonce: Date.now() })}
        onDrillWorkflow={() => setMeterDrill({ category: 'workflow', nonce: Date.now() })} />

      {/* BILLING-USAGE-REDESIGN-1 — KPI row + day/week chart + drill-down + table,
          own folder (§3 size discipline). Replaces the old CreditsUsageCard +
          UsageDailySection pair (same /billing/usage source, one coherent block). */}
      <UsageOverviewSection period={billingPeriod} drillRequest={meterDrill} onPeriodChange={setBillingPeriod} wa={wa} waLoading={waPhase === 'loading'}
        onSubscriptionChange={handleSubscriptionChange} />

      {/* AI usage (Koios) — real data, period-scoped via the shared QuickViewToggle. */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.ai.title')}</SectionTitle>
          <div style={{ display: 'flex', gap: 6 }}>
            <QuickViewToggle active={period === 'today'} onToggle={() => setPeriod('today')} label={t('billing.usage.periodToday')} />
            <QuickViewToggle active={period === 'month'} onToggle={() => setPeriod('month')} label={t('billing.usage.periodMonth')} />
          </div>
        </div>

        {aiPhase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
        {aiPhase === 'error' && <p style={notice}>{t('billing.usage.ai.loadError')}</p>}
        {aiPhase === 'unavailable' && <p style={notice}>{t('billing.usage.ai.unavailable')}</p>}
        {aiPhase === 'empty' && <p style={notice}>{t('billing.usage.ai.empty')}</p>}

        {aiPhase === 'ready' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <Tile label={t('billing.usage.ai.calls')} value={formatNumber(ai?.totals?.calls)} />
              <Tile label={t('billing.usage.ai.tokens')} value={formatNumber((ai?.totals?.input_tokens ?? 0) + (ai?.totals?.output_tokens ?? 0))} />
              <Tile label={t('billing.usage.ai.cost')} value={formatCurrency(ai?.totals?.amount, ai?.totals?.currency)} />
            </div>

            {ai?.forecast && (
              <p style={{ ...notice, marginBottom: 12 }}>
                {t('billing.usage.ai.forecastLine', {
                  avg: formatCurrency(ai.forecast.avg_daily_amount, ai.forecast.currency),
                  projected: formatCurrency(ai.forecast.projected_month_amount, ai.forecast.currency),
                })}
              </p>
            )}

            {Array.isArray(ai?.per_activity) && ai.per_activity.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{t('billing.usage.ai.colActivity')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('billing.usage.ai.colCalls')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('billing.usage.ai.colTokens')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('billing.usage.ai.colCost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ai.per_activity.map((row) => (
                    <tr key={row.activity}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{row.activity}</td>
                      <td style={numCell}>{formatNumber(row.calls)}</td>
                      <td style={numCell}>{formatNumber((row.input_tokens ?? 0) + (row.output_tokens ?? 0))}</td>
                      <td style={numCell}>{formatCurrency(row.amount, ai?.totals?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Koios AI billing (K0) — invoice-ready Claude + workflow-token totals for a picked month. */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.koios.title')}</SectionTitle>
            <div style={sub}>{t('billing.usage.koios.subtitle')}</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Caption>{t('billing.usage.koios.monthLabel')}</Caption>
            <input type="month" value={month} aria-label={t('billing.usage.koios.monthLabel')}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              style={{ padding: '5px 8px', fontSize: 12, background: 'var(--input-bg)', color: 'var(--text)',
                       border: '1px solid var(--border)', borderRadius: 6 }} />
          </label>
        </div>

        {billingPhase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
        {billingPhase === 'error' && <p style={notice}>{t('billing.usage.koios.loadError')}</p>}
        {billingPhase === 'unavailable' && <p style={notice}>{t('billing.usage.koios.unavailable')}</p>}
        {billingPhase === 'empty' && <p style={notice}>{t('billing.usage.koios.empty')}</p>}

        {billingPhase === 'ready' && billing && (
          <>
            {/* Claude token/cost lines — CREDITS-1 §9-reparatie: cost + margin_pct are
                GONE from this endpoint (purchase-price leak); billable_cost is the
                actual sale price and stays the only money line here. */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
              <tbody>
                <tr>
                  <td style={td}>{t('billing.usage.koios.claude.tokensIn')}</td>
                  <td style={numCell}>{formatNumber(billing.claude?.tokens_in)}</td>
                </tr>
                <tr>
                  <td style={td}>{t('billing.usage.koios.claude.tokensOut')}</td>
                  <td style={numCell}>{formatNumber(billing.claude?.tokens_out)}</td>
                </tr>
                <tr>
                  <td style={td}>{t('billing.usage.koios.claude.freeAllowance')}</td>
                  <td style={numCell}>{formatNumber(billing.claude?.free_allowance)}</td>
                </tr>
                <tr>
                  <td style={{ ...td, fontWeight: 600, borderBottom: 'none' }}>{t('billing.usage.koios.claude.billable')}</td>
                  <td style={{ ...numCell, fontWeight: 600, borderBottom: 'none' }}>{formatCurrency(billing.claude?.billable_cost, billing.currency)}</td>
                </tr>
              </tbody>
            </table>

            {/* Workflow token line — the button (icon + run count) toggles the per-module
                breakdown; the amount is a plain sibling, not inside the button, so its
                accessible name stays just the run-count text (no silent concatenation
                with the amount for assistive tech) — the "explain the invoice to the
                customer" story from the K0 handoff. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <Button variant="ghost" size="sm" onClick={() => setBreakdownOpen((o) => !o)} aria-expanded={breakdownOpen}>
                {breakdownOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {t('billing.usage.koios.workflow.line', { n: formatNumber(billing.workflow?.total_module_runs) })}
              </Button>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>
                {formatCurrency(billing.workflow?.amount, billing.currency)}
              </span>
            </div>

            {breakdownOpen && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
                <thead>
                  <tr>
                    <th style={th}>{t('billing.usage.koios.workflow.colModule')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('billing.usage.koios.workflow.colRuns')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('billing.usage.koios.workflow.colAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(billing.workflow?.per_module ?? {}).map(([moduleType, runs]) => (
                    <tr key={moduleType}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{moduleType}</td>
                      <td style={numCell}>{formatNumber(runs)}</td>
                      <td style={numCell}>
                        {formatCurrency((Number(runs) || 0) * (billing.workflow?.price_cents_per_run ?? 0) / 100, billing.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Grand total — Claude billable cost + workflow-token amount, invoice-ready. */}
            {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- flex ROW wrapper holding two <span> children (label + Mono amount), not a text atom itself; BodyText can't host a space-between layout */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10,
                         borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              <span>{t('billing.usage.koios.total')}</span>
              <span style={{ fontFamily: 'monospace' }}>{formatCurrency(billing.total_amount, billing.currency)}</span>
            </div>
          </>
        )}
      </div>

      {/* WhatsApp/messaging usage — real data, this month only. */}
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.whatsapp.title')}</SectionTitle>
        <div style={sub}>{t('billing.usage.whatsapp.subtitle')}</div>

        {waPhase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
        {waPhase === 'error' && <p style={notice}>{t('billing.usage.whatsapp.loadError')}</p>}
        {waPhase === 'unavailable' && <p style={notice}>{t('billing.usage.whatsapp.unavailable')}</p>}
        {waPhase === 'empty' && <p style={notice}>{t('billing.usage.whatsapp.empty')}</p>}

        {waPhase === 'ready' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <Tile label={t('billing.usage.whatsapp.numbers')} value={formatNumber(wa?.usage?.active_numbers)} />
              <Tile label={t('billing.usage.whatsapp.messages')} value={formatNumber(wa?.usage?.waba_messages)} />
              <Tile label={t('billing.usage.whatsapp.cost')} value={formatCurrency(wa?.cost?.total, wa?.currency)} />
            </div>

            {Array.isArray(wa?.by_number) && wa.by_number.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{t('billing.usage.whatsapp.colNumber')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('billing.usage.whatsapp.colMessages')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('billing.usage.whatsapp.colCost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {wa.by_number.map((row, i) => (
                    <tr key={row.sending_ref ?? i}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{row.label ?? row.sending_ref}</td>
                      <td style={numCell}>{formatNumber(row.messages)}</td>
                      <td style={numCell}>{formatCurrency(row.cost, wa?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}
