/**
 * useMatchContract — the contract/financial layer for one match
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
import api, { unwrap, isServiceUnavailable } from '@/lib/api'
import type { MatchRow, MatchContractForm } from '@/types/match'
import type { Id } from '@/types/common'

// MATCH-SOORT-1: one CONTRACTREGELS row as read here — detail-only, echoed with
// its server id (never resent by this read-only hook, only MatchModal writes it).
export interface MatchContractLineRead { id?: Id; functionTitle: string; rate: number | null; sortOrder: number | null }

// The editable contract/financial fields — flat, mirrors the PATCH body shape.
export interface MatchContract {
  function_title: string | null
  contract_type: string | null
  start_date: string | null
  end_date: string | null
  hours_per_week: number | null
  cao: string | null
  scale: string | null
  step: string | null
  surcharge: number | null
  purchase_rate: number | null
  sell_rate: number | null
  cost_center: string | null
  billing_emails: string[]
  // REMARKS-INTO-NOTES-1 (09-08): the RETIRED Opmerkingen field. Still read (the
  // column still holds data), but the only write left is clearing it after its
  // content was copied into a note — see MatchRemarksBlock.
  remarks: string | null
  // MATCH-SOORT-1: Contractvorm chip + its CONTRACTREGELS read-list — read-only
  // here (the edit path is MatchModal's own contract_form/contract_lines write,
  // §2 of the changelog); this section only DISPLAYS the resolved values.
  contractForm: MatchContractForm | null
  contractLines: MatchContractLineRead[]
  // M17: customer-facing match text — the backend column doesn't exist yet
  // (MATCH-TEXT-FIELD-1), so callers must check `matchTextPresent` (below)
  // before trusting this value: absent-key and present-but-null both map here.
  match_text: string | null
  // Derived server-side (sell − purchase); read-only, never sent back on save.
  margin: number | null
}

const EMPTY: MatchContract = {
  function_title: null, contract_type: null, start_date: null, end_date: null, hours_per_week: null,
  cao: null, scale: null, step: null, surcharge: null, purchase_rate: null, sell_rate: null,
  cost_center: null, billing_emails: [], remarks: null, contractForm: null, contractLines: [], match_text: null, margin: null,
}

// Pull just the contract/financial keys off a raw API row (tolerant of extras).
function pick(d: Record<string, unknown>): MatchContract {
  const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))
  return {
    function_title: (d.function_title as string) ?? null,
    contract_type:  (d.contract_type as string) ?? null,
    start_date:     (d.start_date as string) ?? null,
    end_date:       (d.end_date as string) ?? null,
    hours_per_week: num(d.hours_per_week),
    cao:            (d.cao as string) ?? null,
    scale:          (d.scale as string) ?? null,
    step:           (d.step as string) ?? null,
    surcharge:      num(d.surcharge),
    purchase_rate:  num(d.purchase_rate),
    sell_rate:      num(d.sell_rate),
    cost_center:    (d.cost_center as string) ?? null,
    billing_emails: Array.isArray(d.billing_emails) ? (d.billing_emails as unknown[]).map(String) : [],
    remarks:        (d.remarks as string) ?? null,
    contractForm:   (d.contract_form as MatchContractForm) ?? null,
    contractLines:  Array.isArray(d.contract_lines)
      ? (d.contract_lines as Array<Record<string, unknown>>).map(l => ({
          id: l.id as Id | undefined,
          functionTitle: (l.function_title as string) ?? '',
          rate: num(l.rate),
          sortOrder: l.sort_order != null ? Number(l.sort_order) : null,
        }))
      : [],
    match_text:     (d.match_text as string) ?? null,
    margin:         num(d.margin),
  }
}

// See the file's top doc above; fetches the contract/financial detail once per match and owns its optimistic save-with-revert.
// Read-only termination read-back (MATCH-DRILL-2, K-126) — detail payload only,
// so it lives NEXT TO the editable contract, never inside the PATCH-body shape.
export interface MatchTermination {
  stopReason: string | null
  stopReasonLabel: string | null
  effectiveDate: string | null
  terminatedAt: string | null
  renewalCount: number | null
}
// Pull the nested termination block plus the renewal counter off a detail row.
function pickTermination(d: Record<string, unknown>): MatchTermination | null {
  const term = (d.termination ?? null) as Record<string, unknown> | null
  const renewal = d.renewal_count != null ? Number(d.renewal_count) : null
  if (!term && renewal == null) return null
  return {
    stopReason: (term?.stop_reason as string) ?? null,
    stopReasonLabel: (term?.stop_reason_label as string) ?? null,
    effectiveDate: (term?.effective_date as string) ?? null,
    terminatedAt: (term?.terminated_at as string) ?? null,
    renewalCount: renewal,
  }
}

export function useMatchContract(
  matchId: Id | undefined,
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void,
) {
  const [data,    setData]    = useState<MatchContract>(EMPTY)
  const [termination, setTermination] = useState<MatchTermination | null>(null)
  const [loading, setLoading] = useState(true)
  // Raw fetch error kept (not just a boolean) so a 503 — the integration simply
  // isn't configured yet — can be told apart from a real failure (C-15).
  const [rawError, setRawError] = useState<unknown>(null)
  const [saving,  setSaving]  = useState(false)
  // Bumped on a failed save so the (uncontrolled) EditableFieldTable — which only
  // reads its `value` prop once, on mount — remounts from the reverted `data`.
  const [revertTick, setRevertTick] = useState(0)
  // Bumped by retry() to re-run the load effect below.
  const [fetchTick, setFetchTick] = useState(0)
  // M17 OFFERED-IFF-READ: whether the fetched payload actually carried the
  // `match_text` key (present, even if null) — the backend column doesn't
  // exist yet (MATCH-TEXT-FIELD-1), so MatchTextBlock stays hidden until it does.
  const [matchTextPresent, setMatchTextPresent] = useState(false)

  // Load the contract layer once per match (detail-only fields — never on the list row).
  useEffect(() => {
    if (!matchId) { setData(EMPTY); setTermination(null); setLoading(false); setMatchTextPresent(false); return }
    let alive = true
    setLoading(true); setRawError(null)
    api.get(`/matches/${matchId}`)
      .then(r => {
        if (!alive) return
        const raw = (unwrap(r) ?? {}) as Record<string, unknown>
        setData(pick(raw))
        setTermination(pickTermination(raw))
        setMatchTextPresent('match_text' in raw)
      })
      .catch(err => { if (alive) setRawError(err) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [matchId, fetchTick])

  const retry = useCallback(() => setFetchTick(v => v + 1), [])

  // A 503 means the integration this detail layer depends on isn't configured
  // yet — that's a calm "not available" state, never a hard error banner.
  const unavailable = rawError ? isServiceUnavailable(rawError) : false
  const error = !!rawError && !unavailable

  // Save: optimistic apply → PATCH → merge the server's echo (margin/approval may
  // be recomputed), or revert + rethrow on failure so the caller can toast the message.
  const save = useCallback(async (patch: Partial<MatchContract>) => {
    if (!matchId) return
    const prev = data
    setData(p => ({ ...p, ...patch }))
    setSaving(true)
    try {
      const r = await api.patch(`/matches/${matchId}`, patch)
      const row = (unwrap(r)) as Record<string, unknown> | undefined
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

  return { data, termination, loading, error, unavailable, saving, revertTick, retry, save, matchTextPresent }
}
