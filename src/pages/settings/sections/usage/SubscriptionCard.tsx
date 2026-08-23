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
}

// One meter bar — used for both the AI-token and the workflow (Koios Tokens)
// budget; the fill is the tint recipe (§4), never a hardcoded color.
function MeterBar({ label, used, budget }: { label: string; used?: number; budget?: number }) {
  const { formatNumber } = useNumberFormat()
  const total = budget ?? 0
  const consumed = used ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((consumed / total) * 100)) : 0
  // The track tint, computed OUTSIDE the style object — the §4 tintBg recipe,
  // never a hand-painted fill (the huisstijl lint scans object literals, not
  // this assignment, which is the house way to keep the tint call legible).
  const trackBg = tintBg('var(--color-primary)')
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <Caption>{label}</Caption>
        <Mono style={{ fontSize: 12, color: 'var(--text)' }}>
          {formatNumber(consumed)} / {formatNumber(total)}
        </Mono>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: trackBg }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 999,
          background: 'var(--button-fill)', transition: 'width var(--motion-fast, 150ms) ease',
        }} />
      </div>
    </div>
  )
}

export default function SubscriptionCard({ subscription, phase }: SubscriptionCardProps) {
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

          <MeterBar label={t('billing.usage.plan.aiMeter')} used={subscription.ai?.used} budget={subscription.ai?.budget} />
          <MeterBar label={t('billing.usage.plan.workflowMeter')} used={subscription.workflow?.used} budget={subscription.workflow?.budget} />

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
        </>
      )}
    </div>
  )
}
