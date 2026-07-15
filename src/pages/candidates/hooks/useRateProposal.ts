/**
 * useRateProposal — MATCH-PLACEMENT-2 rate proposal for the placement form.
 * Debounced GET /matches/rate-proposal keyed on customer + function (+ optional
 * cao/scale/step); quiet on error (a proposal is a convenience, never a hard
 * block — §3B) and cancels the in-flight request on param change/unmount (§9).
 *
 * Also owns the two behaviours that hang off the proposal: prefilling still-empty
 * rate fields (never the recruiter's own input) and the deviation guard — "did the
 * recruiter's entered rate move away from a FOUND agreement proposal?" (cent-precise,
 * Danny's "weet je het zeker?"). Kept here (not in the modal) to keep that file lean.
 */
import { useState, useEffect } from 'react'
import api, { unwrap } from '@/lib/api'
import type { Id } from '@/types/common'

export type RateProposalSource = 'agreement' | 'conversion_factor' | 'purchase_only' | 'none'

export interface RateProposal {
  found: boolean
  agreement_id?: Id | null
  purchase_rate?: number | null
  sale_rate?: number | null
  margin?: number | null
  source: RateProposalSource
  conversion_factor?: number | null
}

interface RateProposalParams {
  customerId: string
  functionTitle: string
  cao?: string
  scale?: string
  step?: string
  // Current form values + setters — only used to prefill EMPTY fields and to
  // evaluate the deviation guard; never overwritten if already non-empty.
  purchase: string
  sell: string
  setPurchase: (v: string) => void
  setSell: (v: string) => void
}

// Debounce so a proposal fetch doesn't fire on every keystroke while typing cao/scale/step.
const DEBOUNCE_MS = 400

// Cent-precise comparison — avoids float noise (22.180000000000003 !== 22.18).
const centsDiffer = (entered: string, proposed?: number | null) =>
  proposed != null && Math.round((Number(entered) || 0) * 100) !== Math.round(proposed * 100)

export function useRateProposal({ customerId, functionTitle, cao, scale, step, purchase, sell, setPurchase, setSell }: RateProposalParams) {
  const [proposal, setProposal] = useState<RateProposal | null>(null)

  // Fetch the proposal (debounced + cancellable) whenever the pricing inputs change.
  useEffect(() => {
    // Nothing to price without both a customer and a function.
    if (!customerId || !functionTitle) { setProposal(null); return }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      const params: Record<string, string> = { customer_id: customerId, function_title: functionTitle }
      if (cao)   params.cao   = cao
      if (scale) params.scale = scale
      if (step)  params.step  = step
      api.get('/matches/rate-proposal', { params, signal: ctrl.signal, quiet404: true })
        .then(r => setProposal((unwrap(r)) as RateProposal))
        // Quiet on error — an unreachable/unshipped endpoint just means no proposal.
        .catch(err => { if (err?.code !== 'ERR_CANCELED') setProposal(null) })
    }, DEBOUNCE_MS)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [customerId, functionTitle, cao, scale, step])

  // Prefill ONLY still-empty fields once a proposal arrives — never the recruiter's input.
  useEffect(() => {
    if (!proposal?.found) return
    if (purchase === '' && proposal.purchase_rate != null) setPurchase(String(proposal.purchase_rate))
    if (sell === '' && proposal.source !== 'purchase_only' && proposal.sale_rate != null) setSell(String(proposal.sale_rate))
  }, [proposal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deviation guard state — re-armed on every edit so a changed value is re-confirmed.
  const [confirmDeviation, setConfirmDeviation] = useState(false)
  useEffect(() => { setConfirmDeviation(false) }, [purchase, sell])

  // Only a FOUND agreement proposal triggers the guard (conversion_factor/purchase_only
  // are estimates, not a price agreement — deviating from those is expected).
  const hasRates = purchase !== '' && sell !== ''
  const deviatesFromProposal = Boolean(
    proposal?.found && proposal.source === 'agreement' && hasRates &&
    (centsDiffer(purchase, proposal.purchase_rate) || centsDiffer(sell, proposal.sale_rate)),
  )

  return { proposal, deviatesFromProposal, confirmDeviation, setConfirmDeviation }
}
