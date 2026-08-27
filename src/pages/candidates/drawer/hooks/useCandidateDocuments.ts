/**
 * useCandidateDocuments — owns the candidate Documents tab's six persistence
 * paths against /candidates/{id}/documents: upload, rename, replace, delete,
 * bulk delete and re-link (plus the entry-link resolution/derivation those
 * paths need). Split out of DocumentsSection.tsx verbatim (§3 size discipline)
 * — no behaviour change, only file boundaries; DocumentsSection.tsx keeps the
 * search/filter/selection UI state and renders DocumentRow.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { PendingItem } from '../PendingUploadQueue'
import type { LinkKind, LinkedDocItem, ResolvedDocLink } from '../DocumentRow'
import { docKey, isPersisted, splitExt, formatDocSize } from '../documentHelpers'
import type { DocItem } from '../documentHelpers'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1 / DOC-LIST-LINK-1 / REFERENTIE-VELDEN-1:
// maps the "Koppelen aan" picker's "kind:id" prefix to its API relation segment —
// module scope, never rebuilt per render. Shared by the upload-time link
// (linkDocumentToEntry) AND the list row's re-link/clear (relinkDocument) — one
// relation map, one PATCH shape. 'reference' PATCHes /candidates/{id}/references/{item}
// (CMBE shipped candidate_references.document_id, commit 9a9bd8c9).
const RELATION_BY_LINK_KIND: Record<string, string> = { education: 'educations', certification: 'certifications', language: 'languages', skill: 'skills', reference: 'references' }

// REFERENTIE-VELDEN-1: composes a reference row's referent name for the resolved
// link chip — mirrors DocumentLinkPicker's own referenceName (duplicated rather
// than shared: a one-line pure function, and documentHelpers.ts stays out of
// scope for this change, same reasoning ReferencesTab.tsx already documents).
const referenceName = (ref: { first_name?: string; middle_name?: string; last_name?: string }): string =>
  [ref.first_name, ref.middle_name, ref.last_name].filter(Boolean).join(' ')

// DOC-1-EIGENAAR-1 (Danny 08-08, point 5): a 422 on a link PATCH is an EXPECTED,
// caller-handled outcome — the backend guard's own readable reason ("Dit document is
// al aan een ander onderdeel gekoppeld." — i.e. "This document is already linked to
// another item.") is surfaced via extractApiError below. quietStatuses suppresses
// the generic dev diagnostic toast ("API PATCH … → 422", api.ts) that otherwise
// fires first and buries that reason.
const LINK_REQUEST_CONFIG = { quietStatuses: [422] }

// Owns docs/pending state + every persistence path for the candidate's document
// list. `onRefresh` (if provided) re-pulls the whole candidate afterwards —
// Education/Certifications/Languages/Skills all live on a DIFFERENT drawer tab
// that only remounts from fresh props, so this is what keeps that tab's icons
// from opening a stale/missing link.
export function useCandidateDocuments(c: Candidate, onRefresh?: () => void) {
  const { t } = useTranslation('candidates')
  // DOC-ENTRY-LINK-1: the candidate's own educations/certifications feed the
  // "Koppelen aan" grouped picker below (DocumentLinkPicker self-hides when empty).
  const educationsForLink = (c.educations ?? []) as Array<{ id?: Id; title?: string; document_id?: Id | null }>
  const certificationsForLink = (c.certifications ?? []) as Array<{ id?: Id; name?: string; document_id?: Id | null }>
  // DOC-LANG-SKILL-LINK-1: same picker, extended to languages/skills (BE landed
  // document_id on candidate_languages + candidate_skills, mirrors DOC-EDU-1
  // exactly). Filtered to entries with a real id — a legacy plain-string skill
  // or a not-yet-persisted row has nothing a PATCH could target.
  const languagesForLink = ((c.languages ?? []) as Array<{ id?: Id; language?: string; name?: string; document_id?: Id | null }>).filter(l => l.id != null)
  const skillsForLink = (((c.skills ?? []) as unknown) as Array<{ id?: Id; name?: string; document_id?: Id | null }>).filter(s => s?.id != null)
  // REFERENTIE-VELDEN-1: the candidate's own references (referees), same mechanic
  // — filtered to entries with a real id, mirrors languagesForLink/skillsForLink.
  const referencesForLink = ((c.references ?? []) as Array<{ id?: Id; first_name?: string; middle_name?: string; last_name?: string; document_id?: Id | null }>).filter(r => r.id != null)
  // DOC-1-EIGENAAR-1: the five lists in one array — the row's "change link" control is
  // gated on whether THIS document still has a free slot (or its own, so it can always
  // be unlinked), not merely on "the candidate has entries". An occupied entry is not
  // offered (see DocumentLinkPicker), so the old gate showed a button that opened a
  // picker rendering nothing.
  const linkableLists = [educationsForLink, certificationsForLink, languagesForLink, skillsForLink, referencesForLink]

  const [docs, setDocs] = useState<LinkedDocItem[]>(c.documents ?? [])
  const [pending, setPending] = useState<PendingItem[]>([])

  // DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1: PATCH the chosen education/
  // certification/language/skill with the freshly uploaded document's id,
  // parsing the "Koppelen aan" select's "kind:id" value.
  const linkDocumentToEntry = (linkTo: string, documentId: Id) => {
    const [kind, entryId] = linkTo.split(':')
    const relation = RELATION_BY_LINK_KIND[kind]
    if (!relation) return
    api.patch(`/candidates/${c.id}/${relation}/${entryId}`, { document_id: documentId }, LINK_REQUEST_CONFIG)
      .then(() => onRefresh?.())
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }
  // DOC-LIST-LINK-1: resolve which (if any) of the candidate's own educations/
  // certifications/languages/skills a document is linked to, from the reverse FK ids
  // DocumentResource serialises per row. Fixed priority order only matters for a
  // pre-existing double-link (see relinkDocument below) — resolves to the first match
  // rather than rendering two chips.
  const resolveDocLink = (d: LinkedDocItem): ResolvedDocLink | null => {
    if (d.education_id != null) {
      const e = educationsForLink.find(x => x.id === d.education_id)
      if (e) return { kind: 'education', id: d.education_id, label: e.title ?? '' }
    }
    if (d.certification_id != null) {
      const cert = certificationsForLink.find(x => x.id === d.certification_id)
      if (cert) return { kind: 'certification', id: d.certification_id, label: cert.name ?? '' }
    }
    if (d.language_id != null) {
      const lang = languagesForLink.find(x => x.id === d.language_id)
      if (lang) return { kind: 'language', id: d.language_id, label: lang.language ?? lang.name ?? '' }
    }
    if (d.skill_id != null) {
      const skill = skillsForLink.find(x => x.id === d.skill_id)
      if (skill) return { kind: 'skill', id: d.skill_id, label: skill.name ?? '' }
    }
    // REFERENTIE-VELDEN-1: reverse-FK resolution for the reference link, labelled
    // by the referent's own name (never their internal id).
    if (d.reference_id != null) {
      const ref = referencesForLink.find(x => x.id === d.reference_id)
      if (ref) return { kind: 'reference', id: d.reference_id, label: referenceName(ref) }
    }
    return null
  }
  // DOC-LIST-LINK-1: change or clear a PERSISTED document's link from the list row —
  // reuses the exact PATCH path linkDocumentToEntry uses for the upload-time link,
  // extended to also CLEAR the previous side FIRST. MEASURED LIVE (08-08): the
  // reverse-FK design means the old relation never self-clears when a new one is set
  // (setting a second link without clearing the first left BOTH sides pointing at the
  // same document on the real API) — clear-then-set is what keeps "at most one link"
  // true. Snapshot + revert on any failure, mirroring rename/removeDoc below.
  const relinkDocument = async (i: number, newLinkTo: string) => {
    const doc = docs[i]
    const id = doc?.id
    if (!doc || !isPersisted(id)) return
    const previous = resolveDocLink(doc)
    const previousComposite = previous ? `${previous.kind}:${previous.id}` : ''
    if (newLinkTo === previousComposite) return
    let newKind: LinkKind | undefined
    let newId: string | undefined
    if (newLinkTo) { const [k, entryId] = newLinkTo.split(':'); newKind = k as LinkKind; newId = entryId }
    const snapshot = { education_id: doc.education_id, certification_id: doc.certification_id, language_id: doc.language_id, skill_id: doc.skill_id, reference_id: doc.reference_id }
    try {
      if (previous) await api.patch(`/candidates/${c.id}/${RELATION_BY_LINK_KIND[previous.kind]}/${previous.id}`, { document_id: null }, LINK_REQUEST_CONFIG)
      if (newKind) await api.patch(`/candidates/${c.id}/${RELATION_BY_LINK_KIND[newKind]}/${newId}`, { document_id: id }, LINK_REQUEST_CONFIG)
      setDocs(prev => prev.map(x => x.id === id ? { ...x,
        education_id: newKind === 'education' ? newId : null,
        certification_id: newKind === 'certification' ? newId : null,
        language_id: newKind === 'language' ? newId : null,
        skill_id: newKind === 'skill' ? newId : null,
        reference_id: newKind === 'reference' ? newId : null,
      } : x))
      onRefresh?.()
    } catch (err) {
      setDocs(prev => prev.map(x => x.id === id ? { ...x, ...snapshot } : x))
      notifyError(extractApiError(err, t('common:actionFailed')))
    }
  }
  // Upload every queued file (multipart), each with its OWN doc type — one optimistic
  // row + POST per item, so a 5-file pick uploads all 5, not just the first.
  const uploadAll = () => {
    if (!pending.length) return
    const items = pending
    setPending([])
    items.forEach((p, idx) => {
      // Unique per-item tmp id (Date.now() alone would collide across the same tick).
      const tmpId = -(Date.now() + idx)
      const optimistic: DocItem = { id: tmpId, name: p.name, size: p.size, type: p.type, objectUrl: p.objectUrl }
      setDocs(d => [...d, optimistic])
      const fd = new FormData()
      fd.append('file', p.file); fd.append('type', p.type); fd.append('name', p.name)
      api.post(`/candidates/${c.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then(r => {
          const it = unwrap<DocItem>(r)
          if (it?.id) {
            setDocs(d => d.map(x => x.id === tmpId ? { ...optimistic, ...it, size: formatDocSize(it.size) } : x))
            // DOC-ENTRY-LINK-1: only when this file actually had a pick — never
            // fires an empty/no-op PATCH.
            if (p.linkTo) linkDocumentToEntry(p.linkTo, it.id)
          }
        })
        // OPTIMISTIC-REVERT-1: a refused upload (too large, wrong type, permission)
        // must not leave a row claiming the file is stored — drop the optimistic row
        // again and surface the server's own reason, which is what tells the recruiter
        // what to fix.
        .catch(err => {
          setDocs(d => d.filter(x => x.id !== tmpId))
          notifyError(extractApiError(err, t('common:actionFailed')))
        })
    })
  }
  // Set one item's doc type (its own select) without touching the others.
  const setItemType = (idx: number, type: string) => setPending(items => items.map((it, i) => (i === idx ? { ...it, type } : it)))
  // Apply-to-all chip: set the SAME type on every queued item at once.
  const setAllTypes = (type: string) => setPending(items => items.map(it => ({ ...it, type })))
  // DOC-ENTRY-LINK-1: set one item's "Koppelen aan" pick without touching the others.
  const setItemLink = (idx: number, linkTo: string) => setPending(items => items.map((it, i) => (i === idx ? { ...it, linkTo } : it)))
  // Drop one queued item and revoke its blob preview URL so it never leaks.
  const removePending = (idx: number) => setPending(items => {
    const target = items[idx]
    if (target) URL.revokeObjectURL(target.objectUrl)
    return items.filter((_, i) => i !== idx)
  })
  // Cancel the whole queue: revoke every blob URL, then clear.
  const cancelPending = () => { pending.forEach(p => URL.revokeObjectURL(p.objectUrl)); setPending([]) }

  // DOC-VERSIE-1 point 3: swap the FILE on an existing document row (POST …/replace,
  // multipart) — the id/name/type never change, only the bytes + size, and the
  // server snapshots the previous file into `versions` first. Merges the full
  // refreshed contract (size, download_url, versions[]) into the row in place.
  const replaceDoc = (id: Id, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    api.post(`/candidates/${c.id}/documents/${id}/replace`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => {
        const it = unwrap<DocItem>(r)
        if (it) setDocs(prev => prev.map(x => x.id === id ? { ...x, ...it, size: formatDocSize(it.size) } : x))
      })
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // Rename / delete persist once the row has a real (server, non-temp) id.
  // BUG CLASS FIX: a failed rename PATCH used to only toast while the new name
  // stayed in state forever — the user believes it saved until a reload brings
  // the old name back. Snapshot ONLY the `name` field being overwritten (matched
  // by id, since the row's index can shift under concurrent edits) and put it
  // back on failure.
  const rename = (i: number, base: string) => {
    const doc = docs[i]
    const id = doc?.id
    const previousName = doc?.name
    // Re-append the original extension — only the name part is editable.
    const cur = String(doc?.name ?? doc?.file_name ?? '')
    const name = base.trim() + splitExt(cur).ext
    setDocs(prev => prev.map((x, j) => j === i ? { ...x, name } : x))
    if (isPersisted(id)) {
      api.patch(`/candidates/${c.id}/documents/${id}`, { name }).catch(err => {
        setDocs(prev => prev.map(x => x.id === id ? { ...x, name: previousName } : x))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }
  // BUG CLASS FIX: a failed delete used to only toast while the row stayed gone —
  // the user believes the document was removed. Snapshot the removed row (+ its
  // index) and re-insert it on failure, matched by id so a concurrent delete of
  // another row never re-adds the wrong one. `onSelectionPrune` (if given) drops
  // the removed row's own selection key, so a stale key never lingers.
  const removeDoc = (i: number, onSelectionPrune?: (key: string) => void) => {
    const doc = docs[i]
    const id = doc?.id
    onSelectionPrune?.(docKey(doc, i))
    setDocs(prev => prev.filter((_, j) => j !== i))
    if (isPersisted(id)) {
      api.delete(`/candidates/${c.id}/documents/${id}`).catch(err => {
        setDocs(prev => (prev.some(x => x.id === id) ? prev : [...prev.slice(0, i), doc, ...prev.slice(i)]))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }
  // Bulk-delete every selected, persisted doc: resolve the rows by key FIRST (before
  // any state mutation), one DELETE per persisted id, then drop them all in one filter.
  const removeSelected = (selected: Set<string>) => {
    const toRemove = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key))
    setDocs(prev => prev.filter((d, i) => !selected.has(docKey(d, i))))
    // OPTIMISTIC-REVERT-1: each row that the server refuses to delete comes BACK,
    // instead of the recruiter watching files disappear that still exist on the
    // server. Per-row, so one refusal never resurrects the ones that did delete.
    toRemove.forEach(({ d }) => {
      if (!isPersisted(d.id)) return
      api.delete(`/candidates/${c.id}/documents/${d.id}`).catch(err => {
        setDocs(prev => (prev.some(x => x.id === d.id) ? prev : [d, ...prev]))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    })
  }

  return {
    docs, setDocs, pending, setPending,
    educationsForLink, certificationsForLink, languagesForLink, skillsForLink, referencesForLink, linkableLists,
    uploadAll, setItemType, setAllTypes, setItemLink, removePending, cancelPending,
    replaceDoc, rename, removeDoc, removeSelected, relinkDocument, resolveDocLink,
  }
}
