/**
 * CreditsUsageCard (CREDITS-1 fase 1) — the new headline block on billing_usage:
 * sale-price workflow + AI usage from GET /billing/usage?period=month|prev_month.
 * Split out of GebruikSettings (§3 size discipline, >400 lines) — thin, self-
 * fetching card, same convention as its siblings (own period state + 4 UI states).
 * credit_price renders UNROUNDED as delivered (can be a sub-cent fraction like
 * 0.005) — never rounded client-side.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useNumberFormat } from '@/lib/formatters'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { card, cardTitle, sub, notice, Tile } from './usageCardStyles'

export default function CreditsUsageCard() {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const [period, setPeriod] = useState('month')
  const [credits, setCredits] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | ready | empty | error | unavailable

  // Refetches whenever the period toggle changes; a 403 means the user lacks
  // billing.view (should be unreachable — the registry already gates the whole
  // screen on it — but the request still fails safe here too).
  useEffect(() => {
    let alive = true
    setPhase('loading')
    api.get('/billing/usage', { params: { period } })
      .then((res) => {
        if (!alive) return
        // unwrap() already strips the outer { data: … } envelope (lib/api.ts).
        const data = unwrap(res)
        setCredits(data)
        const hasActivity = (data?.workflow?.total_credits ?? 0) > 0
          || (data?.ai?.input_tokens ?? 0) > 0 || (data?.ai?.output_tokens ?? 0) > 0
        setPhase(hasActivity ? 'ready' : 'empty')
      })
      .catch((err) => { if (alive) setPhase(err?.response?.status === 403 ? 'unavailable' : 'error') })
    return () => { alive = false }
  }, [period])

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={cardTitle}>{t('billing.usage.credits.title')}</div>
          <div style={sub}>{t('billing.usage.credits.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <QuickViewToggle active={period === 'month'} onToggle={() => setPeriod('month')} label={t('billing.usage.periodMonth')} />
          <QuickViewToggle active={period === 'prev_month'} onToggle={() => setPeriod('prev_month')} label={t('billing.usage.credits.periodPrevMonth')} />
        </div>
      </div>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.credits.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.credits.unavailable')}</p>}
      {phase === 'empty' && <p style={notice}>{t('billing.usage.credits.empty')}</p>}

      {phase === 'ready' && credits && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('billing.usage.credits.workflowTitle')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <Tile label={t('billing.usage.credits.totalCredits')} value={formatNumber(credits?.workflow?.total_credits)} />
            {/* credit_price is delivered UNROUNDED — up to 4 decimals, e.g. €0,0050 —
                min 2/max 4 decimals so Intl never clips real sub-cent precision. */}
            <Tile label={t('billing.usage.credits.creditPrice')} value={formatCurrency(credits?.workflow?.credit_price, credits?.currency, 4, 2)} />
            <Tile label={t('billing.usage.credits.amount')} value={formatCurrency(credits?.workflow?.amount, credits?.currency)} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('billing.usage.credits.aiTitle')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Tile label={t('billing.usage.ai.tokens')} value={formatNumber((credits?.ai?.input_tokens ?? 0) + (credits?.ai?.output_tokens ?? 0))} />
            <Tile label={t('billing.usage.credits.amount')} value={formatCurrency(credits?.ai?.amount, credits?.currency)} />
          </div>
        </>
      )}
    </div>
  )
}
