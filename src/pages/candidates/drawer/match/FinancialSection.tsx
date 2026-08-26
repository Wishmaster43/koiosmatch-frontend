/**
 * FinancialSection — the "Financieel" block of the match form: schaal/trede,
 * purchase/sell rate + live margin, the rate-proposal hint, cost centre and
 * billing email(s). Split out of MatchModal.tsx (audit R1 item 1,
 * MUST-SPLIT) — pure presentational, all state via props from
 * useMatchForm. Opmerkingen moved OUT into its own `RemarksSection`
 * card (Danny 24-07 point: its own left-column block, collapsed by default).
 *
 * LABEL-LEFT (Danny 13-08): schaal/trede and purchase/sell pair up as short
 * fields (P33 `pairRow`); margin, cost centre and billing email get their own
 * full-width rows.
 */
import { X } from 'lucide-react'
import type { TFunction } from 'i18next'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { useAuth } from '@/context/AuthContext'
import { RateProposalHint } from '../RateProposalNotice'
import type { RateProposal } from '@/pages/candidates/hooks/useRateProposal'
import { FormField as F } from './FormField'
import { input, pairRow, rowLabel, rowField, errMsg } from './styles'
// HUISSTIJL-1: the shared JetBrains Mono atom (identity-only swap).
import { Mono } from '@/components/ui/typography'

// Pure presentational financial block (see the module doc above): all state and the computed margin come from useMatchForm via props.
export default function FinancialSection({
  t, errors,
  scale, setScale, step, setStep,
  purchase, setPurchase, sell, setSell,
  margin, hasRates, proposal,
  costCenter, setCostCenter, setCostCenterDirty,
  billingEmails, setBillingEmails, setBillingDirty,
}: {
  t: TFunction; errors: Record<string, boolean>
  scale: string; setScale: (v: string) => void; step: string; setStep: (v: string) => void
  purchase: string; setPurchase: (v: string) => void; sell: string; setSell: (v: string) => void
  margin: number; hasRates: boolean; proposal: RateProposal | null
  costCenter: string; setCostCenter: (v: string) => void; setCostCenterDirty: (v: boolean) => void
  billingEmails: string[]; setBillingEmails: (fn: (p: string[]) => string[]) => void; setBillingDirty: (v: boolean) => void
}) {
  // MATCH-FIN-GATE-1 (Danny 14-08): the match create/edit form is the third
  // surface carrying purchase rate + margin — gated on `matches.financial.view`,
  // same as MatchContractSection/PriceAgreementForm. Sell rate stays visible;
  // the field is left untouched (never wiped) so an unpermitted user editing an
  // existing match resubmits whatever value was already there.
  const auth = useAuth()
  const canSeeFinancial = !!auth?.hasPermission?.('matches.financial.view')

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={pairRow}>
        <F label={t('placement.scale')} error={errors.scale}>
          {(labelId: string) => <input value={scale} onChange={e => setScale(e.target.value)} style={input} aria-labelledby={labelId} />}
        </F>
        <F label={t('placement.step')} error={errors.step}>
          {(labelId: string) => <input value={step} onChange={e => setStep(e.target.value)} style={input} aria-labelledby={labelId} />}
        </F>
      </div>
      <div style={canSeeFinancial ? pairRow : undefined}>
        {canSeeFinancial && (
          <F label={t('placement.purchaseRate')} error={errors.purchase}>
            {(labelId: string) => <input type="number" step="0.01" value={purchase} onChange={e => setPurchase(e.target.value)} style={input} placeholder="22,18" aria-labelledby={labelId} />}
          </F>
        )}
        <F label={t('placement.sellRate')} error={errors.sell}>
          {(labelId: string) => <input type="number" step="0.01" value={sell} onChange={e => setSell(e.target.value)} style={input} placeholder="62,10" aria-labelledby={labelId} />}
        </F>
      </div>
      {/* Margin — derived, never entered; its own full-width row (compact box, not
          a full input footprint) right below the rates it derives from. Hidden
          entirely without the permission (MATCH-FIN-GATE-1). */}
      {canSeeFinancial && (
        <F label={t('placement.margin')}>
          <div style={{ ...input, width: 110, display: 'flex', alignItems: 'center', fontSize: 13,
            background: 'var(--surface-2, var(--bg))',
            color: hasRates ? (margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
            {/* HUISSTIJL-1: identical fontFamily/weight render. */}
            <Mono style={{ fontWeight: 700 }}>{hasRates ? margin.toFixed(2) : '—'}</Mono>
          </div>
        </F>
      )}
      {/* Rate proposal hint — only fills EMPTY fields above (never overwrites input). */}
      {canSeeFinancial && <RateProposalHint proposal={proposal} />}
      {/* Cost centre — proposed from the customer/location cascade above; typing
          here freezes it (job 21/22 — never overwritten again after that). */}
      <F label={t('placement.costCenter')} error={errors.costCenter}>
        {/* "KP-…" is the cost-centre FORMAT example (tenant data prefix), not
            prose — locale-neutral by design (§5 code/ID class). */}
        <input value={costCenter} onChange={e => { setCostCenterDirty(true); setCostCenter(e.target.value) }}
          style={input} placeholder="KP-…" />
      </F>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Label row carries the "+ e-mail" action RIGHT-aligned (Danny 24-07) —
            same placement as the Contactpersoon "+ nieuw" row in RelationsSection,
            not left-aligned under the field. */}
        <div style={{ ...rowLabel, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{t('placement.billingEmail')}</span>
          <DrawerAddButton onClick={() => { setBillingDirty(true); setBillingEmails(p => [...p, '']) }} label={t('placement.addBillingEmail')} />
        </div>
        <div style={rowField}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {billingEmails.map((em, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="email" value={em} placeholder={i === 0 ? t('placement.billingEmailMain') : t('placement.billingEmailExtra')}
                  onChange={e => { setBillingDirty(true); setBillingEmails(p => p.map((x, j) => j === i ? e.target.value : x)) }} style={input} />
                {billingEmails.length > 1 && (
                  <button onClick={() => { setBillingDirty(true); setBillingEmails(p => p.filter((_, j) => j !== i)) }} aria-label={t('common:close')}
                    style={{ flexShrink: 0, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={13} /></button>
                )}
              </div>
            ))}
          </div>
          {errors.billingEmails && <div style={errMsg}>{t('common:required')}</div>}
        </div>
      </div>
    </div>
  )
}
