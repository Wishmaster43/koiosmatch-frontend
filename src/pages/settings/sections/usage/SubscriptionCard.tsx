/**
 * SubscriptionCard (PRIJSMODEL-C assembler, TASK G) — package head + three
 * consumption meters (AI tokens, workflow runs, WhatsApp Tokens) + the users
 * line. AI/workflow render through the shared <TierMeter> once the backend
 * ships tier fields; presence-gated fallback keeps the older CREDITS-2
 * MeterBar rendering alive for a subscription that has none of tier/allowance/
 * state yet, so nothing regresses before BE lands. Data arrives as a prop
 * (lifted out of UsageOverviewSection's /billing/usage fetch) — no request here.
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import { tintBg, tintBorder } from '@/lib/tint'
import { useAuth } from '@/context/AuthContext'
import { SectionTitle, Mono, Caption } from '@/components/ui/typography'
import { card, notice } from '../usageCardStyles'
import TierMeter from './TierMeter'
import SubscriptionUsersLine from './SubscriptionUsersLine'
import type { BillingUsageSubscription, BillingUsageTierMeter } from '@/types/billingUsage'

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

// A tier-shaped meter has arrived once the server sends any of tier/allowance/
// state — the fallback below stays alive for an older response that has none.
function hasTierFields(meter?: BillingUsageTierMeter | null): boolean {
  return !!meter && (meter.tier !== undefined || meter.allowance !== undefined || meter.state !== undefined)
}

// One meter bar — the pre-PRIJSMODEL-C fallback for AI/workflow, and the
// still-current WhatsApp Tokens rendering (K-196, unchanged). Exported for
// TenantUsageKpiRow.
export function MeterBar({ label, used, budget, onDrill }: { label: string; used?: number; budget?: number; onDrill?: () => void }) {
  const { t } = useTranslation('settings')
  const { formatNumber } = useNumberFormat()
  const total = budget ?? 0
  const consumed = used ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((consumed / total) * 100)) : 0
  const remaining = Math.max(0, total - consumed)
  const trackBg = tintBg('var(--color-primary)')
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, gap: 10 }}>
        <Caption>{label}</Caption>
        {/* Sized explicitly: Mono inherits 16px otherwise and would outgrow the 13px card title (Danny 24-08). */}
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

// `over` is a COUNT — `> 0` guard, never truthiness (a bare 0 leaked onto the
// billing screen for every tenant within budget). Shared by all three fallback meters.
function OverBudgetLine({ meterLabel, over, amount, t, formatNumber, formatCurrency }: {
  meterLabel: string; over?: number; amount?: number
  t: (k: string, o?: Record<string, unknown>) => string
  formatNumber: (v: number) => string; formatCurrency: (v?: number) => string
}) {
  if (!over || over <= 0) return null
  return (
    <p style={{ ...notice, color: 'var(--color-danger-text)' }}>
      {t('billing.usage.plan.overBudget', { meter: meterLabel, n: formatNumber(over), amount: formatCurrency(amount) })}
    </p>
  )
}

// Package head + the three consumption meters — AI and workflow via TierMeter
// (or the CREDITS-2 fallback), WhatsApp via the existing MeterBar, users last.
export default function SubscriptionCard({ subscription, phase, onDrillAi, onDrillWorkflow }: SubscriptionCardProps) {
  const { t } = useTranslation('settings')
  const { formatCurrency, formatNumber } = useNumberFormat()
  const { formatDate } = useDateFormat()
  // The mailto upgrade subject names the real tenant, never the package label.
  const tenantName = useAuth()?.activeTenant?.name ?? undefined
  const resetsAt = subscription?.period?.resets_at ?? subscription?.resets_at

  return (
    <div style={{ ...card, border: tintBorder('var(--color-primary)') }}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.plan.title')}</SectionTitle>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.plan.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.plan.unavailable')}</p>}
      {/* The notice is ONLY for a missing subscription block — a zero-usage month still has budgets. */}
      {(phase === 'ready' || phase === 'empty') && !subscription && <p style={notice}>{t('billing.usage.plan.notice')}</p>}

      {(phase === 'ready' || phase === 'empty') && subscription && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionTitle style={{ marginBottom: 0 }}>
              {subscription.package_label ?? subscription.package_key ?? '—'}
            </SectionTitle>
            {resetsAt && (
              <Caption>{t('billing.usage.plan.resetsOn', { date: formatDate(resetsAt) })}</Caption>
            )}
          </div>

          {hasTierFields(subscription.ai) ? (
            <TierMeter label={t('billing.usage.plan.tier.aiTitle')} meter={subscription.ai} unit="token" tenantName={tenantName} onDrill={onDrillAi} />
          ) : (
            <MeterBar label={t('billing.usage.plan.aiMeter')} used={subscription.ai?.used} budget={subscription.ai?.budget} onDrill={onDrillAi} />
          )}
          {hasTierFields(subscription.workflow) ? (
            <TierMeter label={t('billing.usage.plan.tier.workflowTitle')} meter={subscription.workflow} unit="run" tenantName={tenantName} onDrill={onDrillWorkflow} />
          ) : (
            <MeterBar label={t('billing.usage.plan.workflowMeter')} used={subscription.workflow?.used} budget={subscription.workflow?.budget} onDrill={onDrillWorkflow} />
          )}

          {/* Third meter (CMBE, F5 25-08) — WhatsApp Tokens, unchanged K-196 view. */}
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

          {/* Fallback-only over-budget lines — TierMeter carries its own state
              copy (warn/blocked/overage) once tier fields have landed. */}
          {!hasTierFields(subscription.ai) && (
            <OverBudgetLine meterLabel={t('billing.usage.plan.aiMeter')} over={subscription.ai?.over} amount={subscription.ai?.over_amount} t={t} formatNumber={formatNumber} formatCurrency={formatCurrency} />
          )}
          {!hasTierFields(subscription.workflow) && (
            <OverBudgetLine meterLabel={t('billing.usage.plan.workflowMeter')} over={subscription.workflow?.over} amount={subscription.workflow?.over_amount} t={t} formatNumber={formatNumber} formatCurrency={formatCurrency} />
          )}
          <OverBudgetLine meterLabel={t('billing.usage.plan.whatsappMeter')} over={subscription.whatsapp?.over} amount={subscription.whatsapp?.over_amount} t={t} formatNumber={formatNumber} formatCurrency={formatCurrency} />

          <SubscriptionUsersLine users={subscription.users} />
        </>
      )}
    </div>
  )
}
