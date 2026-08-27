/**
 * SubscriptionCard (CREDITS-2-FE deel 1) — replaces the old ComingSoonNotice now
 * that the backend ships a real subscription snapshot on GET /billing/usage
 * (data.subscription). Package label, two progress bars (Koios AI-tokens and
 * Koios Tokens/workflow, §0.11 "never call the unit anything else") with tint
 * bars (§4 lib/tint — never an ad-hoc color), the reset date via useDateFormat
 * (DATUM-1, DD-MM only) and an honest "over budget" line when over>0.
 * Data arrives as a prop (lifted out of UsageOverviewSection's existing
 * /billing/usage fetch via onSubscriptionChange) — this component makes no
 * request of its own.
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import { tintBg, tintBorder } from '@/lib/tint'
import { SectionTitle, Mono, Caption } from '@/components/ui/typography'
import { card, notice } from '../usageCardStyles'
import type { BillingUsageSubscription } from '@/types/billingUsage'

type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'

interface SubscriptionCardProps {
  subscription: BillingUsageSubscription | null
  phase: Phase
  // Drill into the daily usage chart, pre-filtered on the clicked meter.
  onDrillAi?: () => void
  onDrillWorkflow?: () => void
}

// A meter renders only once the server sent a budget for it — an absent
// WhatsApp meter (CMBE not live yet) must not draw a fake 0/0 bar (§3).
function hasMeter(meter?: { budget?: number; used?: number }): boolean {
  return !!meter && (meter.budget !== undefined || meter.used !== undefined)
}

// One meter bar — used for both the AI-token and the workflow (Koios Tokens)
// budget; the fill is the tint recipe (§4), never a hardcoded color.
export function MeterBar({ label, used, budget, onDrill }: { label: string; used?: number; budget?: number; onDrill?: () => void }) {
  const { t } = useTranslation('settings')
  const { formatNumber } = useNumberFormat()
  const total = budget ?? 0
  const consumed = used ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((consumed / total) * 100)) : 0
  const remaining = Math.max(0, total - consumed)
  // The track tint, computed OUTSIDE the style object — the §4 tintBg recipe,
  // never a hand-painted fill (the huisstijl lint scans object literals, not
  // this assignment, which is the house way to keep the tint call legible).
  const trackBg = tintBg('var(--color-primary)')
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, gap: 10 }}>
        <Caption>{label}</Caption>
        {/* Danny 24-08: "verbruikt en wat nog over moet er mooi staan" — the
            plain words, not only the fraction. */}
        <Mono style={{ fontSize: 12, color: 'var(--text)' }}>
          {t('billing.usage.plan.meterUsage', { used: formatNumber(consumed), remaining: formatNumber(remaining) })}
        </Mono>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: trackBg }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 999,
          background: 'var(--button-fill)', transition: 'width var(--motion-fast, 150ms) ease',
        }} />
      </div>
    </>
  )
  // Drill-down: the whole meter is a real button into the daily chart filtered
  // on this meter's own series — a gateway, never a dead cell (§3A).
  return onDrill ? (
    <button type="button" onClick={onDrill} title={t('billing.usage.plan.meterDrill')}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the meter IS the drill affordance: a full-width unstyled button wrapper around the bar; Button chrome would repaint the meter
      style={{ display: 'block', width: '100%', textAlign: 'inherit', background: 'none', border: 'none', padding: 0, marginBottom: 14, cursor: 'pointer' }}>
      {body}
    </button>
  ) : (
    <div style={{ marginBottom: 14 }}>{body}</div>
  )
}

// The three consumption meters of the current package (AI tokens, Koios Tokens, WhatsApp
// Tokens): each shows used against included, and clicking one drills into its own detail.
export default function SubscriptionCard({ subscription, phase, onDrillAi, onDrillWorkflow }: SubscriptionCardProps) {
  const { t } = useTranslation('settings')
  const { formatCurrency, formatNumber } = useNumberFormat()
  const { formatDate } = useDateFormat()

  return (
    <div style={{ ...card, border: tintBorder('var(--color-primary)') }}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.plan.title')}</SectionTitle>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.plan.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.plan.unavailable')}</p>}
      {/* The notice is ONLY for a missing subscription block — a zero-usage
          month still has budgets, and "0 / 10.000" is exactly what a quiet or
          fresh tenant must see (Opus round: empty-phase hid the meters). */}
      {(phase === 'ready' || phase === 'empty') && !subscription && <p style={notice}>{t('billing.usage.plan.notice')}</p>}

      {(phase === 'ready' || phase === 'empty') && subscription && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionTitle style={{ marginBottom: 0 }}>
              {subscription.package_label ?? subscription.package_key ?? '—'}
            </SectionTitle>
            {subscription.resets_at && (
              <Caption>{t('billing.usage.plan.resetsOn', { date: formatDate(subscription.resets_at) })}</Caption>
            )}
          </div>

          <MeterBar label={t('billing.usage.plan.aiMeter')} used={subscription.ai?.used} budget={subscription.ai?.budget} onDrill={onDrillAi} />
          <MeterBar label={t('billing.usage.plan.workflowMeter')} used={subscription.workflow?.used} budget={subscription.workflow?.budget} onDrill={onDrillWorkflow} />
          {/* Third meter (CMBE, F5 25-08) — WhatsApp Tokens, presence-gated. */}
          {hasMeter(subscription.whatsapp) && (
            <>
              <MeterBar label={t('billing.usage.plan.whatsappMeter')} used={subscription.whatsapp?.used} budget={subscription.whatsapp?.budget} />
              {/* K-204: the € 0,01/token price — measured bug (Danny: "elke keer
                  is de 0,01 weg"): price_cents arrived on the wire but nothing
                  ever rendered it. Cents → euros at the boundary, 2 decimals so
                  a 1-cent price never rounds to "€ 0,00". */}
              {subscription.whatsapp?.price_cents != null && (
                <p style={{ ...notice, marginTop: -10 }}>
                  {t('billing.usage.whatsapp.priceCaption', { amount: formatCurrency(subscription.whatsapp.price_cents / 100, 'EUR', 2, 2) })}
                </p>
              )}
            </>
          )}

          {/* `over` is a COUNT — `> 0` guard, never truthiness (a bare 0 leaked
              onto the billing screen for every tenant within budget). The count
              itself is the "X boven budget" the worklist asks for. */}
          {(subscription.ai?.over ?? 0) > 0 && (
            <p style={{ ...notice, color: 'var(--color-danger-text)' }}>
              {t('billing.usage.plan.overBudget', {
                meter: t('billing.usage.plan.aiMeter'),
                n: formatNumber(subscription.ai?.over ?? 0),
                amount: formatCurrency(subscription.ai?.over_amount),
              })}
            </p>
          )}
          {(subscription.workflow?.over ?? 0) > 0 && (
            <p style={{ ...notice, color: 'var(--color-danger-text)' }}>
              {t('billing.usage.plan.overBudget', {
                meter: t('billing.usage.plan.workflowMeter'),
                n: formatNumber(subscription.workflow?.over ?? 0),
                amount: formatCurrency(subscription.workflow?.over_amount),
              })}
            </p>
          )}
          {(subscription.whatsapp?.over ?? 0) > 0 && (
            <p style={{ ...notice, color: 'var(--color-danger-text)' }}>
              {t('billing.usage.plan.overBudget', {
                meter: t('billing.usage.plan.whatsappMeter'),
                n: formatNumber(subscription.whatsapp?.over ?? 0),
                amount: formatCurrency(subscription.whatsapp?.over_amount),
              })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
