/**
 * runGuardedNoteEdit — wraps noteEditGuard's snapshot-or-bail check for the
 * common editNote shape: no id/index match resolves false, otherwise `run`
 * gets the target + pre-edit snapshot and returns whether the write landed.
 * Shared by useApplicationNotes/useCandidateNotes/usePopoutCustomerNotes, whose
 * editNote each repeated the same "guard, then destructure" head before their
 * own optimistic map + request differ.
 */
import { noteEditGuard } from '@/hooks/noteEditGuard'

export function runGuardedNoteEdit<T>(
  id: unknown,
  notes: T[],
  index: number,
  run: (target: T, snapshot: T[]) => Promise<boolean>,
): Promise<boolean> {
  const guard = noteEditGuard(id, notes, index)
  if (!guard) return Promise.resolve(false)
  return run(guard.target, guard.snapshot)
}
