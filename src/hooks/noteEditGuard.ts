/**
 * noteEditGuard — the shared HEAD of every notes hook's editNote (useApplicationNotes,
 * useCandidateNotes, usePopoutCustomerNotes): bail when the owning record has no id,
 * or when the list index no longer resolves to a note, otherwise snapshot the current
 * list before the optimistic write. The request body, the optimistic field map and the
 * resolution (reload vs. in-place patch) differ per entity and stay in each hook's own
 * editNote — this is a pure guard only (the CANDHOOKS `useEntityNotes` body-key design
 * is a separate, not-yet-built item).
 */
export function noteEditGuard<T>(id: unknown, notes: T[], index: number): { target: T; snapshot: T[] } | null {
  if (!id) return null
  const target = notes[index]
  if (!target) return null
  return { target, snapshot: notes }
}
