/**
 * useDeletionLifecycle (TRASH-OVERAL-2) — the ONE hook behind the trash flow of
 * all seven trash-enabled entities. Loads the deletion preview for a record,
 * marks/unmarks it for erasure, and exposes the tenant's grace window so the UI
 * can say "wordt rond {date} definitief verwijderd" honestly (or fall back to
 * neutral wording when the window is unknown — never a fabricated date).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { loadSettings } from '@/pages/settings/shared'
import type {
  DeletionBlocker, DeletionConflictBody, DeletionMarkResponse, DeletionPreview, MarkDeletionBody,
} from '@/types/deletion'

// Outcome of a mark attempt: blocked=true means the server answered 409 in_use
// (the transfer, if any, was NOT applied) and `blocking` holds the fresh list.
export interface MarkDeletionResult {
  blocked: boolean
  blocking: DeletionBlocker[]
}

// Module-level promise cache: the tenant's grace window is one number for the whole
// session, fetched once via the same GET /settings the retention screen uses.
// Deliberately NEVER aborted — a shared promise cache wants the RESULT (§9).
let graceDaysPromise: Promise<number | null> | null = null

// Resolve deletion_grace_days from tenant settings; null when the call fails or
// the key is absent/invalid (a failed fetch clears the cache so a later mount retries).
function fetchGraceDays(): Promise<number | null> {
  if (!graceDaysPromise) {
    graceDaysPromise = loadSettings()
      .then((stored: Record<string, unknown>) => {
        const n = Number(stored?.deletion_grace_days)
        return Number.isFinite(n) && n > 0 ? n : null
      })
      .catch(() => { graceDaysPromise = null; return null })
  }
  return graceDaysPromise
}

// Test-only: reset the module cache between tests. Never called from app code.
export function __resetDeletionGraceCache(): void { graceDaysPromise = null }

// Projected erasure moment: pending_erase_at + the tenant grace window, or null
// when either half is unknown/unparseable (caller then shows neutral wording).
export function eraseAroundDate(pendingEraseAt: string | null | undefined, graceDays: number | null): Date | null {
  if (!pendingEraseAt || graceDays == null) return null
  const d = new Date(pendingEraseAt)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + graceDays)
  return d
}

export function useDeletionLifecycle(entityPath: string, id: string | null) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(id))
  const [error, setError] = useState(false)
  const [graceDays, setGraceDays] = useState<number | null>(null)
  // Epoch guard (§9): a fast id switch or unmount must never let a stale
  // preview response win over the current entity's.
  const epochRef = useRef(0)

  const base = id ? `/${entityPath}/${id}` : null

  // Load (or reload) the live preview: blockers, transfer hint, lifecycle.
  const refresh = useCallback(() => {
    if (!base) return
    const epoch = ++epochRef.current
    setLoading(true)
    setError(false)
    api.get(`${base}/deletion-preview`)
      .then(res => { if (epochRef.current === epoch) setPreview(unwrap<DeletionPreview>(res)) })
      .catch(() => { if (epochRef.current === epoch) setError(true) })
      .finally(() => { if (epochRef.current === epoch) setLoading(false) })
  }, [base])

  // Entity-keyed load: reset then fetch per record; cleanup bumps the epoch so
  // in-flight responses from the previous record are dropped.
  useEffect(() => {
    setPreview(null)
    setError(false)
    if (!base) { setLoading(false); return }
    refresh()
    return () => { epochRef.current++ }
  }, [base, refresh])

  // One shared grace-window fetch per session (see cache above); alive-guarded
  // setState only — the promise itself is never aborted.
  useEffect(() => {
    let alive = true
    fetchGraceDays().then(n => { if (alive) setGraceDays(n) })
    return () => { alive = false }
  }, [])

  // Mark for erasure. Sends transfer_to_owner_id ONLY when actually picked; a 409
  // in_use is an expected outcome (a relation appeared after the preview): update
  // the local blocking list and report it — never throw that raw at the UI.
  const mark = useCallback(async (transferToOwnerId?: string | null): Promise<MarkDeletionResult> => {
    if (!base) throw new Error('useDeletionLifecycle.mark called without an id')
    const body: MarkDeletionBody = transferToOwnerId ? { transfer_to_owner_id: transferToOwnerId } : {}
    try {
      const res = await api.post(`${base}/mark-deletion`, body, { quietStatuses: [409] })
      const data = unwrap<DeletionMarkResponse>(res)
      setPreview(prev => prev ? { ...prev, lifecycle: data?.lifecycle ?? 'pending_erase' } : prev)
      return { blocked: false, blocking: [] }
    } catch (err) {
      const resp = (err as { response?: { status?: number; data?: Partial<DeletionConflictBody> } }).response
      if (resp?.status === 409 && resp.data?.code === 'in_use') {
        const blocking = resp.data.blocking ?? []
        // A 409 also means the transfer was NOT applied — reflect the blocked state locally.
        setPreview(prev => prev ? { ...prev, blocking, can_mark: false } : prev)
        return { blocked: true, blocking }
      }
      throw err
    }
  }, [base])

  // Back from the trash to plain archived (restore-to-active stays /restore).
  const unmark = useCallback(async (): Promise<void> => {
    if (!base) throw new Error('useDeletionLifecycle.unmark called without an id')
    await api.post(`${base}/unmark-deletion`)
    setPreview(prev => prev ? { ...prev, lifecycle: 'archived' } : prev)
  }, [base])

  return { preview, loading, error, graceDays, refresh, mark, unmark }
}
