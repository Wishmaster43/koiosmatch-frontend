/**
 * UsageWhatsAppTab (F5, "WhatsApp") — presence-based: once GET /billing/usage
 * carries `whatsapp.by_channel` (CMBE, F5 handoff 25-08) this renders a table
 * per channel (waba / waba_coex / wa_web) with WhatsApp Tokens (1 wa_web
 * message = 1 token) + the tokens meter; until then it falls back to the
 * existing GET /settings/messaging-costs by_number card, with an honest
 * "this month" caption since that endpoint has no period param.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useNumberFormat } from '@/lib/formatters'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { SectionTitle } from '@/components/ui/typography'
import { card, sub, notice, Tile } from '../usageCardStyles'
import { MeterBar } from './SubscriptionCard'
import type { BillingUsageWhatsapp, BillingUsageWhatsappChannel } from '@/types/billingUsage'

interface MessagingCosts {
  usage?: { active_numbers?: number; waba_messages?: number }
  cost?: { total?: number }
  currency?: string
  by_number?: Array<{ sending_ref?: string; label?: string; messages?: number; cost?: number }>
}

interface UsageWhatsAppTabProps {
  whatsapp: BillingUsageWhatsapp | undefined
}

// Usage settings' WhatsApp tab: per-number message/cost breakdown from the billing-usage payload.
export default function UsageWhatsAppTab({ whatsapp }: UsageWhatsAppTabProps) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('candidates')
  const { formatNumber, formatCurrency } = useNumberFormat()

  const [fallback, setFallback] = useState<MessagingCosts | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unavailable'>('loading')
  // The backend always sends all three Channel rows (zeros when a channel is
  // unused), so gate on real activity (messages > 0), not just array presence
  // — presence alone would make the legacy fallback below permanently dead.
  const hasChannelData = (whatsapp?.by_channel ?? []).some((c) => (c.messages ?? 0) > 0)

  // Only fetch the legacy fallback when the new channel data is absent.
  useEffect(() => {
    if (hasChannelData) return
    const ctrl = new AbortController()
    setPhase('loading')
    api.get('/settings/messaging-costs', { signal: ctrl.signal })
      .then((res) => {
        const data = unwrap<MessagingCosts>(res)
        setFallback(data)
        setPhase((data?.usage?.waba_messages ?? 0) > 0 ? 'ready' : 'empty')
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setPhase(err?.response?.status === 403 ? 'unavailable' : 'error')
      })
    return () => ctrl.abort()
  }, [hasChannelData])

  const channelColumns: Column<BillingUsageWhatsappChannel>[] = [
    { key: 'channel', header: t('billing.usage.whatsapp.colChannel'), render: (r) => tc(`conversations.channel.${r.channel}`, { defaultValue: r.label ?? r.channel }) },
    { key: 'messages', header: t('billing.usage.whatsapp.colMessages'), align: 'right', render: (r) => formatNumber(r.messages) },
    { key: 'tokens', header: t('billing.usage.whatsapp.colTokens'), align: 'right', render: (r) => formatNumber(r.tokens) },
    { key: 'amount', header: t('billing.usage.whatsapp.colCost'), align: 'right', render: (r) => formatCurrency(r.amount) },
  ]

  if (hasChannelData) {
    const tokens = whatsapp?.tokens
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.whatsapp.title')}</SectionTitle>
        <div style={sub}>{t('billing.usage.whatsapp.subtitle')}</div>

        {tokens && (
          <div style={{ marginBottom: 14 }}>
            <MeterBar label={t('billing.usage.whatsapp.tokensMeterLabel')} used={tokens.used} budget={tokens.budget} />
            {/* K-204: the € 0,01/token price — measured bug (Danny: "elke keer
                is de 0,01 weg"): price_cents arrived on the wire but nothing
                ever rendered it. Cents → euros at the boundary, 2 decimals so
                a 1-cent price never rounds to "€ 0,00". */}
            {tokens.price_cents != null && (
              <p style={notice}>
                {t('billing.usage.whatsapp.priceCaption', { amount: formatCurrency(tokens.price_cents / 100, 'EUR', 2, 2) })}
              </p>
            )}
            {(tokens.over ?? 0) > 0 && (
              <p style={{ ...notice, color: 'var(--color-danger-text)' }}>
                {t('billing.usage.plan.overBudget', {
                  meter: t('billing.usage.whatsapp.tokensMeterLabel'),
                  n: formatNumber(tokens.over ?? 0),
                  amount: formatCurrency(tokens.over_amount),
                })}
              </p>
            )}
          </div>
        )}

        <DataTable columns={channelColumns} rows={whatsapp!.by_channel!} getRowId={(r) => r.channel}
          emptyText={t('billing.usage.whatsapp.empty')} />
      </div>
    )
  }

  // Legacy fallback — by_number, always "this month" (§0.5 no ISO/raw slug leak).
  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.whatsapp.title')}</SectionTitle>
      <div style={sub}>{t('billing.usage.whatsapp.fallbackCaption')}</div>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.whatsapp.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.whatsapp.unavailable')}</p>}
      {phase === 'empty' && <p style={notice}>{t('billing.usage.whatsapp.empty')}</p>}

      {phase === 'ready' && fallback && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <Tile label={t('billing.usage.whatsapp.numbers')} value={formatNumber(fallback.usage?.active_numbers)} />
            <Tile label={t('billing.usage.whatsapp.messages')} value={formatNumber(fallback.usage?.waba_messages)} />
            <Tile label={t('billing.usage.whatsapp.cost')} value={formatCurrency(fallback.cost?.total, fallback.currency)} />
          </div>

          {Array.isArray(fallback.by_number) && fallback.by_number.length > 0 && (
            <DataTable
              columns={[
                { key: 'label', header: t('billing.usage.whatsapp.colNumber'), render: (r) => r.label ?? r.sending_ref },
                { key: 'messages', header: t('billing.usage.whatsapp.colMessages'), align: 'right', render: (r) => formatNumber(r.messages) },
                { key: 'cost', header: t('billing.usage.whatsapp.colCost'), align: 'right', render: (r) => formatCurrency(r.cost, fallback.currency) },
              ]}
              rows={fallback.by_number}
              getRowId={(r) => r.sending_ref ?? r.label ?? 'row'}
              emptyText={t('billing.usage.whatsapp.empty')}
            />
          )}
        </>
      )}
    </div>
  )
}
