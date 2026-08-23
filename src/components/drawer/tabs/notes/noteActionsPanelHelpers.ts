/**
 * noteActionsPanelHelpers — pure transforms behind NoteActionsPanel, split
 * into their own module so the panel file stays component-only (Fast
 * Refresh only reloads cleanly when a file exports components alone).
 */
import type { NoteActionPanelItem } from './NoteActionsPanel'
import type { AssistActionType } from './noteAssistApi'

// Merge a fresh suggestion batch into the existing panel items — dedupe on
// title+type so a re-run "Verwerken" never duplicates a card, and an
// already-executed/pending item KEEPS its status instead of resetting to
// proposed (Danny punt 6: results survive a follow-up assist call).
export function mergeNoteActionItems(existing: NoteActionPanelItem[], fresh: { title: string; type: AssistActionType; due_date: string | null; note_excerpt: string | null; message?: string | null; start?: string | null }[]): NoteActionPanelItem[] {
  const byKey = new Map(existing.map(it => [`${it.title}__${it.type}`, it]))
  const merged = [...existing]
  for (const f of fresh) {
    const key = `${f.title}__${f.type}`
    if (byKey.has(key)) continue
    merged.push({ ...f, status: 'proposed' })
  }
  return merged
}

// Every currently-known item, in the shape the assist call's `known_items`
// wants — plain title+type, so the model can dedupe against what the panel
// already holds (max 50 per contract; the panel never approaches that).
export function toKnownItems(items: NoteActionPanelItem[]): { title: string; type: string }[] {
  return items.map(it => ({ title: it.title, type: it.type }))
}
