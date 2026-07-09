/**
 * RateProposalNotice — the two small presentational bits the placement form's rate
 * proposal (MATCH-PLACEMENT-2) needs: a subtle "voorstel" hint under the purchase/
 * sell fields, and the deviation-guard confirm box shown when the recruiter's own
 * rates differ from a FOUND agreement proposal (Danny's "weet je het zeker?").
 * Split out of MatchPlacementModal to keep that file under the size cap (§0.3).
 */
import { useTranslation } from 'react-i18next'
import type { RateProposal } from '../hooks/useRateProposal'

// Subtle italic hint — source-labelled, shown only once a proposal was FOUND.
export function RateProposalHint({ proposal }: { proposal: RateProposal | null }) {
  const { t } = useTranslation('candidates')
  if (!proposal?.found) return null
  const purchase = proposal.purchase_rate?.toFixed(2) ?? '—'
  const sell = proposal.sale_rate?.toFixed(2) ?? '—'
  return (
    <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--color-info)' }}>
      {proposal.source === 'purchase_only'
        ? t('placement.rateProposal.purchaseOnly', { purchase })
        : t(`placement.rateProposal.${proposal.source === 'agreement' ? 'agreement' : 'conversionFactor'}`, { purchase, sell })}
    </div>
  )
}

// Deviation guard — one extra click confirms, no hard block (soft warning tint, §4).
export function RateDeviationWarning({ proposal, purchase, sell, onCancel }: {
  proposal: RateProposal | null; purchase: string; sell: string; onCancel: () => void
}) {
  const { t } = useTranslation('candidates')
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, padding: '9px 11px', borderRadius: 8, fontSize: 12,
      color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
      <span style={{ fontWeight: 600 }}>
        {t('placement.rateProposal.deviationWarning', {
          proposalPurchase: proposal?.purchase_rate?.toFixed(2) ?? '—', proposalSell: proposal?.sale_rate?.toFixed(2) ?? '—',
          enteredPurchase: Number(purchase).toFixed(2), enteredSell: Number(sell).toFixed(2),
        })}
      </span>
      <button onClick={onCancel}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 12, fontWeight: 600, padding: 0, textDecoration: 'underline' }}>
        {t('placement.rateProposal.deviationCancel')}
      </button>
    </div>
  )
}
