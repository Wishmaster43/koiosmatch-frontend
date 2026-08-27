/**
 * useMatchesTrash — MatchesPage's archive + trash (Prullenbak) wiring,
 * extracted verbatim (§0.3 split). Wraps useMatchArchive + useTrashFlow, the
 * two permission checks, and the mark-deletion label builder that reads the
 * row's candidate/vacancy for the confirmation modal's intro text.
 */
import { useAuth } from '@/context/AuthContext'
import { useMatchArchive } from './useMatchArchive'
import { useTrashFlow } from '@/hooks/useTrashFlow'
import type { MatchRow } from '@/types/match'

interface UseMatchesTrashArgs {
  rows: MatchRow[]
  selected: MatchRow | null
  patchRow: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  reload: () => void
  setSelected: (row: MatchRow | null) => void
}

export function useMatchesTrash({ rows, selected, patchRow, reload, setSelected }: UseMatchesTrashArgs) {
  const auth = useAuth()
  // Coupling is authorization-gated in the UI; the backend re-checks (§7).
  const hasPermission = auth?.hasPermission ?? (() => false)

  // ARCHIVE-1: per-id archive/restore (enkelstuks-sweep, BE 9170e40) — gated on
  // matches.update, the same permission the DELETE/restore routes themselves require.
  const { archiveMatch, restoreMatch, dialog: archiveConfirmDialog } = useMatchArchive({ onPatch: patchRow, onReload: reload })
  const canArchive = hasPermission('matches.update')

  // TRASH-OVERAL-2: mark/unmark wiring + the shared preview-modal state. Mark is
  // gated matches.delete (button HIDDEN without it — §7 no fake affordances);
  // unmark reuses the matches.update gate the archive/restore routes carry.
  const trash = useTrashFlow({
    entityPath: 'matches',
    onMarked: () => { setSelected(null); reload() },
    onUnmarked: () => { setSelected(null); reload() },
  })
  const canMarkDeletion = hasPermission('matches.delete')
  // Human label for the modal intro — candidate + vacancy (— is a data separator here).
  const openMarkDeletion = (id: MatchRow['id']) => {
    if (id == null) return
    const row = rows.find(r => String(r.id) === String(id)) ?? selected
    const label = [row?.candidate, row?.vacancy].filter(v => v && v !== '—').join(' — ') || String(id)
    trash.openFor(String(id), label)
  }

  return {
    archiveMatch, restoreMatch, archiveConfirmDialog, canArchive,
    trash, canMarkDeletion, openMarkDeletion,
  }
}
