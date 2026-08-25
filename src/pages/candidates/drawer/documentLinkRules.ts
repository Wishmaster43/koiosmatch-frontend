/**
 * documentLinkRules — the ONE place that decides which documents / which entries a
 * "koppelen" ("link") picker may still offer (DOC-1-EIGENAAR-1, Danny 08-08, point 6).
 *
 * MEASURED live 08-08 against koiosmatch-api.test:
 *  - `PATCH /candidates/{id}/certifications/{cert}` with a `document_id` that already
 *    hangs on another entry answers **422** with, verbatim:
 *    `{"message":"Dit document is al aan een
 *    ander onderdeel gekoppeld.", errors:{document_id:[…]}}`
 *    (i.e. "This document is already linked to another item.")
 *    — the backend guard (Services/Candidate/DocumentOwnershipGuard) enforces "one
 *    document → at most one owner" across candidate_educations / _certifications /
 *    _languages / _skills / _references, and explicitly EXCLUDES the row being saved.
 *  - The reverse side is NOT guarded: PATCHing a second document onto an entry that
 *    already carries one answers **200** and silently releases the first document.
 *
 * So a picker must never offer a slot that is already taken, in EITHER direction:
 * an already-claimed document is not linkable (it would 422), and an entry that
 * already carries another document is not a safe target (it would silently steal).
 * The row's OWN current pick always stays offered — otherwise a recruiter can no
 * longer see, switch or clear the choice they made.
 */
import type { Id } from '@/types/common'

// The five reverse-FK ids DocumentResource serialises per document row — one per
// table in the backend guard's OWNER_TABLES list. A document is claimed as soon as
// any of them is set.
const DOCUMENT_OWNER_KEYS = ['education_id', 'certification_id', 'language_id', 'skill_id', 'reference_id'] as const

/** A candidate document, as these rules see it (DocumentResource's reverse links). */
export interface OwnableDocument {
  id?: Id
  education_id?: Id | null
  certification_id?: Id | null
  language_id?: Id | null
  skill_id?: Id | null
  reference_id?: Id | null
}

/** An entry that can claim a document via its own `document_id` column. */
export interface ClaimingEntry {
  id?: Id
  document_id?: Id | null
}

// Ids arrive as UUID strings from the API but as numbers on optimistic temp rows —
// compare as strings so a mixed pair still matches (never `===` on raw values).
const sameId = (a: Id | null | undefined, b: Id | null | undefined): boolean =>
  a != null && a !== '' && b != null && b !== '' && String(a) === String(b)

/** True when the document already hangs on some entry (any of the five reverse FKs). */
export const isDocumentClaimed = (doc: OwnableDocument): boolean =>
  DOCUMENT_OWNER_KEYS.some(key => doc[key] != null)

/**
 * The documents an entry may still be linked to: everything unclaimed, plus the one
 * this entry already holds. `siblings` (the other entries of the same section) are
 * consulted too, because a link saved earlier in this session is visible there long
 * before the candidate — and with it the documents' reverse FKs — is refetched.
 */
export function selectableDocuments<T extends OwnableDocument>(
  documents: T[],
  { currentDocumentId, siblings = [], currentEntryId }: {
    currentDocumentId?: Id | null
    siblings?: ClaimingEntry[]
    currentEntryId?: Id | null
  } = {},
): T[] {
  return documents.filter(doc => {
    if (sameId(doc.id, currentDocumentId)) return true
    if (isDocumentClaimed(doc)) return false
    return !siblings.some(entry => !sameId(entry.id, currentEntryId) && sameId(entry.document_id, doc.id))
  })
}

/**
 * The entries a document may still be linked to: everything with a free slot, plus
 * the entry this document currently hangs on (so the pick stays visible/switchable).
 */
export function selectableEntries<T extends ClaimingEntry>(entries: T[], currentEntryId?: Id | null): T[] {
  return entries.filter(entry => sameId(entry.id, currentEntryId) || entry.document_id == null)
}

/** True when at least one of the given entry lists still has a slot for this document. */
export function hasSelectableEntry(entryLists: ClaimingEntry[][], currentEntryId?: Id | null): boolean {
  return entryLists.some(list => selectableEntries(list, currentEntryId).length > 0)
}

/** A document as a picker renders it — labelled by its own file name, never an id. */
type NamedDocument = OwnableDocument & { name?: unknown; file_name?: unknown }

/**
 * The ONE "gekoppeld document" ("linked document") option builder, shared by every
 * section that can claim a document (opleiding · certificering · vaardigheid · taal ·
 * referentie — education · certification · skill · language · reference) so all five
 * offer exactly the same set — §11: adopt the shared helper, never a per-section copy.
 * `entry` is the row being edited (its `id` + current `document_id`); a fresh add row
 * simply passes an empty object.
 */
export function documentLinkOptions(
  documents: NamedDocument[],
  siblings: ClaimingEntry[],
  entry: ClaimingEntry,
): Array<{ value: string; label: string }> {
  return selectableDocuments(documents, { currentDocumentId: entry.document_id, siblings, currentEntryId: entry.id })
    .map(doc => ({ value: String(doc.id ?? ''), label: String(doc.name ?? doc.file_name ?? '') }))
}

/**
 * The AddForm-shaped resolver around documentLinkOptions: AddForm calls it with the
 * row's CURRENT form values (which carry the row `id` + its `document_id`), so the
 * option list is computed per row instead of once per section.
 */
export const linkedDocumentOptions = (documents: NamedDocument[], siblings: ClaimingEntry[]) =>
  (values: Record<string, unknown>): Array<{ value: string; label: string }> =>
    documentLinkOptions(documents, siblings, {
      id: values.id as Id | undefined,
      document_id: values.document_id as Id | null | undefined,
    })
