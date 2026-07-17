/**
 * FinancialSection — the "Financieel" block of the placement form: schaal/trede,
 * purchase/sell rate + live margin, the rate-proposal hint, cost centre, billing
 * email(s) and the remarks rich-text block. Split out of MatchPlacementModal.tsx
 * (audit R1 item 1, MUST-SPLIT) — pure presentational, all state via props from
 * useMatchPlacementForm.
 */
import { X } from 'lucide-react'
import type { TFunction } from 'i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { RateProposalHint } from '../RateProposalNotice'
import type { RateProposal } from '@/pages/candidates/hooks/useRateProposal'
import { FormField as F } from './FormField'
import { input, row2, row3 } from './styles'

export default function FinancialSection({
  t, errors,
  scale, setScale, step, setStep,
  purchase, setPurchase, sell, setSell,
  margin, hasRates, proposal,
  costCenter, setCostCenter, setCostCenterDirty,
  billingEmails, setBillingEmails, setBillingDirty,
  remarks, setRemarks, remarksExpanded, setRemarksExpanded,
}: {
  t: TFunction; errors: Record<string, boolean>
  scale: string; setScale: (v: string) => void; step: string; setStep: (v: string) => void
  purchase: string; setPurchase: (v: string) => void; sell: string; setSell: (v: string) => void
  margin: number; hasRates: boolean; proposal: RateProposal | null
  costCenter: string; setCostCenter: (v: string) => void; setCostCenterDirty: (v: boolean) => void
  billingEmails: string[]; setBillingEmails: (fn: (p: string[]) => string[]) => void; setBillingDirty: (v: boolean) => void
  remarks: string; setRemarks: (v: string) => void; remarksExpanded: boolean; setRemarksExpanded: (fn: (v: boolean) => boolean) => void
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
      <div style={row2}>
        {/* Cost centre — proposed from the customer/location cascade above; typing
            here freezes it (job 21/22 — never overwritten again after that). */}
        <F label={t('placement.costCenter')} error={errors.costCenter}>
          <input value={costCenter} onChange={e => { setCostCenterDirty(true); setCostCenter(e.target.value) }}
            style={input} placeholder="KP-…" />
        </F>
        <F label={t('placement.billingEmail')} error={errors.billingEmails}>
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
            <button onClick={() => { setBillingDirty(true); setBillingEmails(p => [...p, '']) }}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, padding: 0 }}>+ {t('placement.addBillingEmail')}</button>
          </div>
        </F>
      </div>
      {/* Opmerkingen — the shared rich-text block (house rule, CLAUDE.md §3A/§4),
          not a bare textarea; stored/POSTed as sanitised HTML. */}
      <F label={t('placement.remarks')} error={errors.remarks}>
        <RichTextEditor value={remarks} onChange={setRemarks}
          expanded={remarksExpanded} onToggleExpand={() => setRemarksExpanded(v => !v)} />
      </F>
    </div>
  )
}
