/**
 * useMatchContract — the placement's contract/financial layer for one match
 * (contract type/CAO/dates/hours/scale/step/rates/cost centre/billing emails/
 * remarks + the backend-derived margin). These are detail-only fields (§8 data
 * minimization — the list row never carries them), so this fetches
 * GET /matches/{id} once per match and owns the optimistic PATCH /matches/{id}
 * save: apply locally first, then persist; on failure revert to the last
 * confirmed values and rethrow so the caller can toast the server's message
 * (422/409). A rate/date edit can re-open approval BE-side, so a successful
 * save also bubbles any returned approval_status back to the page (onUpdate)
 * so the header badge stays in sync — no other special-casing needed.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

// The editable contract/financial fields — flat, mirrors the PATCH body shape.
export interface MatchContract {
  contract_type: string | null
  start_date: string | null
  end_date: string | null
  hours_per_week: number | null
  cao: string | null
  scale: string | null
  step: string | null
  purchase_rate: number | null
  sell_rate: number | null
  cost_center: string | null
  billing_emails: string[]
  remarks: string | null
  // Derived server-side (sell − purchase); read-only, never sent back on save.
  margin: number | null
}

const EMPTY: MatchContract = {
  contract_type: null, start_date: null, end_date: null, hours_per_week: null,
  cao: null, scale: null, step: null, purchase_rate: null, sell_rate: null,
  cost_center: null, billing_emails: [], remarks: null, margin: null,
}

// Pull just the contract/financial keys off a raw API row (tolerant of extras).
function pick(d: Record<string, unknown>): MatchContract {
  const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))
  return {
    contract_type:  (d.contract_type as string) ?? null,
    start_date:     (d.start_date as string) ?? null,
    end_date:       (d.end_date as string) ?? null,
    hours_per_week: num(d.hours_per_week),
    cao:            (d.cao as string) ?? null,
    scale:          (d.scale as string) ?? null,
    step:           (d.step as string) ?? null,
    purchase_rate:  num(d.purchase_rate),
    sell_rate:      num(d.sell_rate),
    cost_center:    (d.cost_center as string) ?? null,
    billing_emails: Array.isArray(d.billing_emails) ? (d.billing_emails as unknown[]).map(String) : [],
    remarks:        (d.remarks as string) ?? null,
    margin:         num(d.margin),
  }
}

export function useMatchContract(
  matchId: Id | undefined,
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void,
) {
  const [data,    setData]    = useState<MatchContract>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  // Bumped on a failed save so the (uncontrolled) EditableFieldTable — which only
  // reads its `value` prop once, on mount — remounts from the reverted `data`.
  const [revertTick, setRevertTick] = useState(0)
  // Bumped by retry() to re-run the load effect below.
  const [fetchTick, setFetchTick] = useState(0)

  // Load the contract layer once per match (detail-only fields — never on the list row).
  useEffect(() => {
    if (!matchId) { setData(EMPTY); setLoading(false); return }
    let alive = true
    setLoading(true); setError(false)
    api.get(`/matches/${matchId}`)
      .then(r => { if (alive) setData(pick((r.data?.data ?? r.data ?? {}) as Record<string, unknown>)) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [matchId, fetchTick])

  const retry = useCallback(() => setFetchTick(v => v + 1), [])

  // Save: optimistic apply → PATCH → merge the server's echo (margin/approval may
  // be recomputed), or revert + rethrow on failure so the caller can toast the message.
  const save = useCallback(async (patch: Partial<MatchContract>) => {
    if (!matchId) return
    const prev = data
    setData(p => ({ ...p, ...patch }))
    setSaving(true)
    try {
      const r = await api.patch(`/matches/${matchId}`, patch)
      const row = (r.data?.data ?? r.data) as Record<string, unknown> | undefined
      if (row) {
        setData(pick(row))
        // A rate/date change can re-open approval BE-side — refresh the header badge.
        if (typeof row.approval_status === 'string') {
          onUpdate?.(matchId, {
            approval_status: row.approval_status as string,
            approval_rejected_reason: (row.approval_rejected_reason as string) ?? '',
          })
        }
      }
    } catch (err) {
      setData(prev)
      setRevertTick(v => v + 1)
      throw err
    } finally {
      setSaving(false)
    }
  }, [matchId, data, onUpdate])

  return { data, loading, error, saving, revertTick, retry, save }
}
