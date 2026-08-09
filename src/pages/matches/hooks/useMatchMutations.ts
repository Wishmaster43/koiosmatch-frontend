/**
 * useMatchMutations — the match record's optimistic single-field mutations: the
 * board drag (status), the drawer's status picker (same status field, a
 * different caller), the drawer's owner picker and the Extra tab's tenant custom
 * fields. Bug-class fix
 * (mirrors useCustomerRecord.updateCustomer / useEntityDocuments.remove): the
 * previous inline handlers only showed a toast on a rejected PATCH, leaving the
 * new value sitting on screen as if it had saved. Each mutation here snapshots
 * ONLY the field(s) it is about to overwrite — never the whole row — from BOTH
 * state slices the optimistic write touches (the row list via updateMatch, and
 * the open drawer's `selected` copy), and restores exactly that pair on failure.
 * Extracted out of MatchesPage to keep the page under the ~400-line split
 * trigger (§3) and so each mutation is unit-testable without mounting the page.
 */
import { useTranslation } from 'react-i18next'
import type { Dispatch, SetStateAction } from 'react'
import api from '@/lib/api'
import { notify } from '@/lib/notify'
import { initialsOf } from '@/lib/initials'
import { mergePatch } from '@/lib/mergePatch'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

// The tenant user a match can be reassigned to (the /users row shape useUsers returns).
export interface OwnerCandidate {
  id: Id
  name?: string
  avatar_color?: string | null
}

interface Args {
  rows: MatchRow[]
  selected: MatchRow | null
  updateMatch: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  setSelected: Dispatch<SetStateAction<MatchRow | null>>
}

// Snapshot only the patch's own keys from a row — never the whole record, so a
// concurrent edit to another field survives a later revert (mirrors useCustomerRecord).
function snapshotFields(row: MatchRow | null | undefined, patch: Record<string, unknown>): Partial<MatchRow> | undefined {
  if (!row) return undefined
  const snap: Record<string, unknown> = {}
  Object.keys(patch).forEach(k => { snap[k] = (row as Record<string, unknown>)[k] })
  return snap as Partial<MatchRow>
}

export function useMatchMutations({ rows, selected, updateMatch, setSelected }: Args) {
  const { t } = useTranslation('matches')

  // Optimistically write `patch` into both the row list and the open drawer's
  // copy, after snapshotting exactly the fields it overwrites in each slice —
  // returns a revert() that restores precisely those two snapshots.
  const applyOptimistic = (id: MatchRow['id'], patch: Partial<MatchRow>) => {
    const beforeRow      = snapshotFields(rows.find(r => r.id === id), patch)
    const beforeSelected = selected && selected.id === id ? snapshotFields(selected, patch) : undefined
    updateMatch(id, patch)
    // ZZP-MERGE-1: deep-merge (never shallow-spread), see useMatches.updateMatch.
    setSelected(p => (p && p.id === id ? mergePatch(p as unknown as Record<string, unknown>, patch) as unknown as MatchRow : p))
    return () => {
      if (beforeRow) updateMatch(id, beforeRow)
      if (beforeSelected) setSelected(p => (p && p.id === id ? { ...p, ...beforeSelected } : p))
    }
  }

  // Board drag AND the drawer's status picker both change one match's status
  // (optimistic + PATCH; the is_closed flag server-side ends the match when
  // applicable). Reverts both the row list and the open drawer on failure.
  const setStatus = (id: MatchRow['id'], status: string) => {
    if (id == null) return
    const revert = applyOptimistic(id, { status })
    api.patch(`/matches/${id}`, { status }).catch(() => { revert(); notify('error', t('bulk.mutateError')) })
  }

  // MATCH-OWNER-1: reassign the match's owner. PATCH /matches/{id} accepts
  // `owner_id` (UpdateMatchRequest → PlacementRules::placementRules, tenant-validated
  // via placementOwnerBelongsToTenant), so this is a real persistence path — the
  // drawer's owner was a dead read-only box until now. Writes all four owner display
  // fields optimistically so the header AND the table row update in one go.
  const setOwner = (id: MatchRow['id'], user: OwnerCandidate) => {
    if (id == null || user?.id == null) return
    const revert = applyOptimistic(id, {
      ownerId: user.id,
      owner: user.name ?? '',
      ownerInitials: initialsOf(user.name),
      ownerColor: user.avatar_color ?? null,
    })
    api.patch(`/matches/${id}`, { owner_id: user.id }).catch(() => { revert(); notify('error', t('bulk.mutateError')) })
  }

  // Extra tab's tenant custom fields: merge the partial patch into the full map
  // so the backend persists it whole. Reverts to the pre-merge map on failure.
  const updateCustomFields = (id: MatchRow['id'], patch: Record<string, unknown>) => {
    const merged = { ...(selected?.customFieldValues ?? {}), ...patch }
    const revert = applyOptimistic(id, { customFieldValues: merged })
    api.patch(`/matches/${id}`, { custom_fields: merged }).catch(() => { revert(); notify('error', t('bulk.mutateError')) })
  }

  return { setStatus, setOwner, updateCustomFields }
}
