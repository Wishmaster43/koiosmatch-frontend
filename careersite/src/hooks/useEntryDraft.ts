import { useState } from 'react'

// Shared add/edit-draft state for a repeatable entry list (ExperienceList,
// EducationList) — `editingIndex === null` means "adding a new entry", any
// other number means "editing the entry currently at that index". Extracted
// once so both lists share the exact same open/edit/close/save mechanics
// instead of duplicating the same local-state dance twice.
export interface EntryDraftState<T> {
  editingIndex: number | null
  draft: T
}

export function useEntryDraft<T>(emptyDraft: T) {
  const [state, setState] = useState<EntryDraftState<T> | null>(null)

  // Opens the inline sub-form empty, ready to append a new entry.
  const openAdd = () => setState({ editingIndex: null, draft: emptyDraft })

  // Opens the inline sub-form pre-filled with an existing entry for editing.
  const openEdit = (index: number, entry: T) => setState({ editingIndex: index, draft: entry })

  // Closes the sub-form without saving.
  const close = () => setState(null)

  // Patches the current draft in place (controlled sub-form inputs call this).
  const updateDraft = (patch: Partial<T>) =>
    setState((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : prev))

  return { state, openAdd, openEdit, close, updateDraft }
}
