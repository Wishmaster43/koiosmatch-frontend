/**
 * noteDraftApi — CONCEPT-NOTE-2 (K-161): the durable note concept, one per
 * user × dossier, strictly self-scoped and encrypted at rest server-side.
 * The payload is the serialized NoteDraft (fields + action-panel items); the
 * server caps it at 100k characters, so an oversized draft simply stays a
 * session concept instead of failing loudly (the honest degrade).
 */
import api from '@/lib/api'
import type { NoteDraft } from '@/hooks/useNotesPopout'

// K-161 vocabulary — anything else 422s server-side, so the caller gates on it.
export const NOTE_DRAFT_ENTITY_TYPES = ['candidate', 'customer', 'location', 'department', 'contact', 'opportunity', 'vacancy', 'application', 'match', 'task'] as const
export type NoteDraftEntityType = typeof NOTE_DRAFT_ENTITY_TYPES[number]

const MAX_PAYLOAD = 100000

export async function getNoteDraft(entityType: NoteDraftEntityType, entityId: string, signal?: AbortSignal): Promise<NoteDraft | null> {
  const res = await api.get<{ data: { payload?: string } | null }>(`/note-drafts/${entityType}/${entityId}`, { signal })
  const payload = (res.data as { data?: { payload?: string } | null })?.data?.payload
  if (!payload) return null
  try {
    return JSON.parse(payload) as NoteDraft
  } catch {
    // A corrupt stored payload must never break the notes tab — treat as none.
    return null
  }
}

// Fire-and-forget semantics at the call sites: a failed PUT leaves the session
// concept working, so the user never loses text either way.
export async function putNoteDraft(entityType: NoteDraftEntityType, entityId: string, draft: NoteDraft): Promise<boolean> {
  const payload = JSON.stringify(draft)
  if (payload.length > MAX_PAYLOAD) return false
  await api.put(`/note-drafts/${entityType}/${entityId}`, { payload })
  return true
}

export async function deleteNoteDraft(entityType: NoteDraftEntityType, entityId: string): Promise<void> {
  await api.delete(`/note-drafts/${entityType}/${entityId}`)
}
