/**
 * useNoteFields — the five fields ONE note is written with (type · contact channel
 * · title · text · language) and nothing else.
 *
 * Extracted from NoteComposer when the per-note second-screen window
 * (NOTITIE-POPOUT-URL-1) needed the same form on a route of its own: two screens
 * that edit a note must offer the SAME fields with the same defaults, so there is
 * one implementation and no second form to drift (§11).
 *
 * All fields seed from `seed` at MOUNT and never re-seed: both hosts remount the
 * form (a `key` per compose target in the composer, a `key` per note id in the
 * popout window) when the note being edited changes. That is what keeps a
 * half-typed edit from being silently replaced by a background refetch.
 */
import { useEffect, useState } from 'react'
import type { NotePayload, NoteType } from '../NotesTab'

// What a note form starts from — an existing note, or a handed-over draft. Every
// field optional: a brand-new note seeds from nothing at all.
export interface NoteFieldsSeed {
  type?: string
  channel?: string
  title?: string
  body?: string
  language?: string
}

export interface NoteFieldsState {
  type: string
  setType: (v: string) => void
  channel: string
  setChannel: (v: string) => void
  title: string
  setTitle: (v: string) => void
  body: string
  setBody: (v: string) => void
  language: string | undefined
  setLanguage: (v: string | undefined) => void
  // Ready-to-save payload — the SAME shape onAddNote/onEditNote already take.
  payload: NotePayload
  // True once any field differs from what the form mounted with. Drives the
  // second-screen window's unsaved-changes marker and its close guard; the
  // drill-down composer ignores it (its FloatingPanel has its own cancel).
  dirty: boolean
}

export function useNoteFields(seed: NoteFieldsSeed, noteTypes: NoteType[]): NoteFieldsState {
  // One resolved starting point, captured ONCE (lazy initializer): it is both the
  // initial state of every field AND the baseline `dirty` compares against, so the
  // two can never disagree about what "unchanged" means.
  const [start] = useState(() => ({
    type: seed.type || noteTypes[0]?.value || '',
    channel: seed.channel ?? '',
    title: seed.title ?? '',
    body: seed.body ?? '',
    language: seed.language,
  }))
  const [type, setType] = useState(start.type)
  const [channel, setChannel] = useState(start.channel)
  const [title, setTitle] = useState(start.title)
  const [body, setBody] = useState(start.body)
  // NOTE-TAAL-1: undefined = let the editor fall back to the app locale and the
  // backend to the tenant default — never force a language nobody picked.
  const [language, setLanguage] = useState<string | undefined>(start.language)

  // Resync when the host swaps the writable type list mid-compose (the customer
  // tab's link-level picker switches scope INSIDE the composer) — a stale type from
  // the previous scope would 422 on save.
  useEffect(() => {
    if (noteTypes.length === 0 || noteTypes.some(nt => nt.value === type)) return
    setType(noteTypes[0].value)
  }, [noteTypes, type])

  // Empty strings collapse to undefined: "no channel picked" and "no language
  // picked" must reach the API as absent fields, not as an empty value.
  const payload: NotePayload = { type, title, body, channel: channel || undefined, language: language || undefined }

  // Unsaved-changes marker. A type forced by the resync effect above also counts as
  // a change — correct: that value really would be saved differently than it loaded.
  const dirty =
    type !== start.type || channel !== start.channel || title !== start.title ||
    body !== start.body || (language ?? '') !== (start.language ?? '')

  return { type, setType, channel, setChannel, title, setTitle, body, setBody, language, setLanguage, payload, dirty }
}
