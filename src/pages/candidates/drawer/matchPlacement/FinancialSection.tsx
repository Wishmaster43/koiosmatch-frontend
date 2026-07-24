/**
 * FinancialSection — the "Financieel" block of the placement form: schaal/trede,
 * purchase/sell rate + live margin, the rate-proposal hint, cost centre and
 * billing email(s). Split out of MatchPlacementModal.tsx (audit R1 item 1,
 * MUST-SPLIT) — pure presentational, all state via props from
 * useMatchPlacementForm. Opmerkingen moved OUT into its own `RemarksSection`
 * card (Danny 24-07 point: its own left-column block, collapsed by default).
 */
import { X } from 'lucide-react'
import type { TFunction } from 'i18next'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { RateProposalHint } from '../RateProposalNotice'
import type { RateProposal } from '@/pages/candidates/hooks/useRateProposal'
import { FormField as F } from './FormField'
import { input, row2, row3, lbl, errMsg } from './styles'

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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row2}>
        <F label={t('placement.scale')} error={errors.scale}><input value={scale} onChange={e => setScale(e.target.value)} style={input} /></F>
        <F label={t('placement.step')} error={errors.step}><input value={step} onChange={e => setStep(e.target.value)} style={input} /></F>
      </div>
      {/* S24c: the live margin joins the rate row as a compact read-only cell —
          derived, never entered; sits right next to the rates it derives from. */}
      <div style={row3}>
        <F label={t('placement.purchaseRate')} error={errors.purchase}><input type="number" step="0.01" value={purchase} onChange={e => setPurchase(e.target.value)} style={input} placeholder="22,18" /></F>
        <F label={t('placement.sellRate')} error={errors.sell}><input type="number" step="0.01" value={sell} onChange={e => setSell(e.target.value)} style={input} placeholder="62,10" /></F>
        <F label={t('placement.margin')}>
          <div style={{ ...input, display: 'flex', alignItems: 'center', fontSize: 13,
            background: 'var(--surface-2, var(--bg))',
            color: hasRates ? (margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
            <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{hasRates ? margin.toFixed(2) : '—'}</span>
          </div>
        </F>
      </div>
      {/* Rate proposal hint — only fills EMPTY fields above (never overwrites input). */}
      <RateProposalHint proposal={proposal} />
      {/* Stacked full-width (Danny 24-07): side-by-side squeezed the billing-email
          header until its button wrapped — each gets the card's full width now. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Cost centre — proposed from the customer/location cascade above; typing
            here freezes it (job 21/22 — never overwritten again after that). */}
        <F label={t('placement.costCenter')} error={errors.costCenter}>
          <input value={costCenter} onChange={e => { setCostCenterDirty(true); setCostCenter(e.target.value) }}
            style={input} placeholder="KP-…" />
        </F>
        <div>
          {/* Label row carries the "+ e-mail" action RIGHT-aligned (Danny 24-07) —
              same placement as the Contactpersoon "+ nieuw" row in RelationsSection,
              not left-aligned under the field. */}
          <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('placement.billingEmail')}</span>
            <DrawerAddButton onClick={() => { setBillingDirty(true); setBillingEmails(p => [...p, '']) }} label={t('placement.addBillingEmail')} />
          </div>
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
