import { useCallback } from 'react'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Application } from '@/types/application'

/**
 * useApplicationAdvice — the ONE resolver both the applications TABLE column and
 * the drawer's Koios block call, so they can never disagree
 * (KOIOS-ADVIES-OVERAL-1, mirrors useCandidateAdvice). The list resource's own
 * AI-suggested next action (raw free text, `a.task` / `a.ai_task` / `a.ai.task`
 * — see mapApplication.ts) IS the advice; there is no separate action/reason
 * structure to derive, unlike the other entities' rule engines. Routing it
 * through the shared KoiosAdvice shape gives it ADVICE_META's `task` icon and
 * the same pill every other entity renders — no raw-text bypass. The label is
 * backend copy, so no t() applies here.
 */
export function useApplicationAdvice(): (r: Application) => KoiosAdvice | null {
  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((r: Application): KoiosAdvice | null => (
    r.task ? { action: 'task', label: r.task, source: 'rules' } : null
  ), [])
}
