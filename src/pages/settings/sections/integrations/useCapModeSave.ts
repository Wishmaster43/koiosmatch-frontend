/**
 * useCapModeSave — the save mechanics AdminLimitsTable and TenantLimitsDrawer both
 * need: local draft state, a PUT mutation, a 2s "saved" flash, an inline error on a
 * rejected save, and invalidating the row's own query on success. Split out of
 * CapModeEditorRow.tsx so that file only exports the component (react-refresh).
 */
import { useState } from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { extractApiError } from '@/lib/extractApiError'
import type { LimitMode } from './limitsApi'

// mode is nullable: a row with no stored override serves mode:null (inherit platform
// default), and the PUT itself allows mode:null (§ verifier fix, EffectiveLimit::for()).
export interface CapModeDraft { cap: number | null; mode: LimitMode | null }

// Shared so the two admin surfaces don't hand-roll the PUT/flash/invalidate dance twice.
export function useCapModeSave(row: CapModeDraft, save: (draft: CapModeDraft) => Promise<unknown>, invalidateKey: QueryKey, errorFallback: string) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<CapModeDraft>(row)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => save(draft),
    onSuccess: () => {
      setError(null)
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: invalidateKey })
      setTimeout(() => setSaved(false), 2000)
    },
    // Surface a rejected PUT (limits.mode_fixed / not_settable / unknown_connector / …)
    // instead of leaving the button silently back at "Opslaan" (§3/§10).
    onError: (err) => setError(extractApiError(err, errorFallback)),
  })

  const dirty = draft.cap !== row.cap || draft.mode !== row.mode
  return { draft, setDraft, saved, saving: isPending, dirty, error, save: mutate }
}
