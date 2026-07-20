/**
 * GebruikSettings (billing_usage, USAGE-LIMITS-1) — cross-domain usage & limits
 * overview. Two sections show REAL data, verified against koiosmatch-api:
 *   - AI usage (Koios)   — GET /ai/koios/usage?period=today|month
 *   - WhatsApp usage     — GET /settings/messaging-costs (always "this month")
 * Two pieces of the reference screenshot have NO backend behind them at all yet
 * — (1) current plan + credit progress bar + reset date, and (3) credit balance
 * need a plan/credit model that does not exist (Tenant only has package/add-on
 * gating, no credits ledger); (2) the daily usage graph needs a per-day×category
 * aggregate, but both usage endpoints only return period TOTALS, never a daily
 * series. Both render as calm "not built yet" notices instead of fake numbers
 * (§3 — no fake affordances). Auto top-up is intentionally NOT built here — it
 * was deliberately dropped (billing_pay, R-1) and needs Danny's confirmation
 * before it comes back (see WORKLIST USAGE-LIMITS-1).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useLocale } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import QuickViewToggle from '@/components/ui/QuickViewToggle'

// Shared card chrome — mirrors the Koios settings cards (KoiosStatusCard/KoiosPricingCard).
const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }
const sub = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }
const th = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--border)' }
const td = { fontSize: 12, color: 'var(--text)', padding: '8px', borderBottom: '1px solid var(--border)' }
const numCell = { ...td, fontFamily: 'monospace', textAlign: 'right' }
const notice = { fontSize: 13, color: 'var(--text-muted)' }

// One metric tile (label above a bold value) — mirrors TenantUsageSettings' Tile.
function Tile({ label, value }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 120, background: 'var(--hover-bg)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  )
}

// A calm "not built yet" notice — never a fake number (§3 no fake affordances).
function ComingSoonNotice({ title, text }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Clock size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <div style={cardTitle}>{title}</div>
      </div>
      <p style={notice}>{text}</p>
    </div>
  )
}

export default function GebruikSettings() {
  const { t } = useTranslation('settings')
  const locale = useLocale()
  const { formatNumber } = useNumberFormat()
  // Period toggle — matches the AI usage endpoint's own `period` param exactly.
  const [period, setPeriod] = useState('month')

  const [ai, setAi] = useState(null)
  const [aiPhase, setAiPhase] = useState('loading') // loading | ready | empty | error | unavailable
  const [wa, setWa] = useState(null)
  const [waPhase, setWaPhase] = useState('loading')

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

  // Locale-aware currency formatting, falling back to EUR (mirrors KoiosPricingCard).
  const money = (v, currency) => new Intl.NumberFormat(locale, { style: 'currency', currency: currency ?? 'EUR' }).format(v ?? 0)

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('billing.usage.title')}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('billing.usage.desc')}</p>
      </div>

      {/* Blocked: no plan/credit model exists in the backend yet. */}
      <ComingSoonNotice title={t('billing.usage.plan.title')} text={t('billing.usage.plan.notice')} />

      {/* AI usage (Koios) — real data, period-scoped via the shared QuickViewToggle. */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={cardTitle}>{t('billing.usage.ai.title')}</div>
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
              <Tile label={t('billing.usage.ai.cost')} value={money(ai?.totals?.cost, ai?.totals?.currency)} />
            </div>

            {ai?.forecast && (
              <p style={{ ...notice, marginBottom: 12 }}>
                {t('billing.usage.ai.forecastLine', {
                  avg: money(ai.forecast.avg_daily_cost, ai.forecast.currency),
                  projected: money(ai.forecast.projected_month_cost, ai.forecast.currency),
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
                      <td style={numCell}>{money(row.cost, ai?.totals?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* WhatsApp/messaging usage — real data, this month only. */}
      <div style={card}>
        <div style={cardTitle}>{t('billing.usage.whatsapp.title')}</div>
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
              <Tile label={t('billing.usage.whatsapp.cost')} value={money(wa?.cost?.total, wa?.currency)} />
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
                      <td style={numCell}>{money(row.cost, wa?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Blocked: no per-day×category aggregate exists in the backend yet. */}
      <ComingSoonNotice title={t('billing.usage.daily.title')} text={t('billing.usage.daily.notice')} />
    </div>
  )
}
