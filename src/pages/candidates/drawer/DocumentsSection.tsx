import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Download, Trash2 } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { sectionBlock } from './constants'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
import { useAuth } from '@/context/AuthContext'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import DrawerAddButton from './DrawerAddButton'
import PendingUploadQueue from './PendingUploadQueue'
import type { PendingItem } from './PendingUploadQueue'
import DocumentRow from './DocumentRow'
import type { LinkKind, LinkedDocItem, ResolvedDocLink } from './DocumentRow'
import { hasSelectableEntry } from './documentLinkRules'
import { docKey, isPersisted, docUrl, splitExt, formatDocSize, DOC_GRID_COLUMNS } from './documentHelpers'
import type { DocItem } from './documentHelpers'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
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

// DOC-1-EIGENAAR-1 (Danny 08-08 punt 5): a 422 on a link PATCH is an EXPECTED,
// caller-handled outcome — the backend guard's own readable reason ("Dit document is
// al aan een ander onderdeel gekoppeld.") is surfaced via extractApiError below.
// quietStatuses suppresses the generic dev diagnostic toast ("API PATCH … → 422",
// api.ts) that otherwise fires first and buries that reason.
const LINK_REQUEST_CONFIG = { quietStatuses: [422] }

/** Documents section — owns its own docs state, upload, rename, search and preview.
 * Persists to /candidates/{id}/documents (multipart upload, PATCH rename, DELETE,
 * POST .../replace). New rows keep their local blob preview until the server doc
 * (with url) returns. Row rendering lives in DocumentRow (§3 size discipline);
 * this file owns the state + every persistence path.
 * DOC-LIST-LINK-1 (Danny 08-08): the list row also shows + changes the document's
 * link to an education/certification/language/skill/reference (the upload-time
 * "Koppelen aan" pick was write-only before this — no trace of it showed in the
 * list, and there was no way to change or remove it). See resolveDocLink/relinkDocument. */
export default function DocumentsSection({ c, onRefresh }: { c: Candidate; onRefresh?: () => void }) {
  const { t } = useTranslation('candidates')
  // Point 4: every MANAGE action (upload/rename/replace/delete) gates on this
  // permission; read + download stay available under the drawer's own
  // candidates.view gate (unaffected here — never double-gated).
  const canManage = useAuth()?.hasPermission('candidates.documents.manage') ?? false
  // Document types + colours + icons from the tenant lookup (seed fallback until /document-types lands).
  // Candidate documents: this entity's types plus the global ones (see DocumentsTab).
  const { types: docTypes, labelOf: docTypeLabel, colorOf: docColor, iconOf: docTypeIcon } = useDocumentTypes('candidate')
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
  const [docs,        setDocs]        = useState<LinkedDocItem[]>(c.documents ?? [])
  const [pending,      setPending]     = useState<PendingItem[]>([])
  const [renamingDoc, setRenamingDoc] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // DOC-LIST-LINK-1: which document row's inline "Koppelen aan" re-link picker is
  // open — at most one at a time, mirrors renamingDoc.
  const [linkingDoc,  setLinkingDoc]  = useState<number | null>(null)
  const [docSearch,   setDocSearch]   = useState('')
  // DOC-TYPE-FILTER-1 (Danny 08-08): filter the list by document type, via the
  // house searchable dropdown fed by the tenant document-type lookup — '' = all.
  const [docTypeFilter, setDocTypeFilter] = useState('')
  const [previewDoc,  setPreviewDoc]  = useState<DocItem | null>(null)
  // Bulk-download selection, keyed by docKey — cleared once a download batch starts.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Pending delete confirmation — a single row (by index) or the whole bulk
  // selection; nothing is removed until the shared ConfirmDialog is confirmed.
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one'; index: number } | { kind: 'many' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // DOC-VERSIE-1 point 3: which doc a replace-file pick targets — set right before
  // the hidden single-file input opens, consumed (and cleared) on its onChange.
  const [replaceTargetId, setReplaceTargetId] = useState<Id | null>(null)
  const replaceFileRef = useRef<HTMLInputElement>(null)

  // Rows currently visible under the search filter, with their original index kept.
  const filteredDocs = docs.map((d, i) => ({ ...d, _i: i }))
    .filter(d => !docSearch || (d.name ?? d.file_name ?? '').toLowerCase().includes(docSearch.toLowerCase()) || (d.type ?? '').toLowerCase().includes(docSearch.toLowerCase()))
    .filter(d => !docTypeFilter || (d.type ?? '') === docTypeFilter)
  const filteredDownloadableKeys = filteredDocs.filter(d => docUrl(d)).map(d => docKey(d, d._i))
  const allFilteredSelected = filteredDownloadableKeys.length > 0 && filteredDownloadableKeys.every(k => selected.has(k))

  // Select-all toggles every currently-filtered downloadable row at once.
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredDownloadableKeys.forEach(k => next.delete(k))
      else filteredDownloadableKeys.forEach(k => next.add(k))
      return next
    })
  }
  const toggleSelectedRow = (key: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }
  // Start the sequential download for every selected doc, in list order, then clear.
  const downloadSelected = async () => {
    const items = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key)).map(({ d }) => ({ url: docUrl(d), name: d.name ?? d.file_name }))
    await downloadFilesSequentially(items)
    setSelected(new Set())
  }

  // DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1: PATCH the chosen education/
  // certification/language/skill with the freshly uploaded document's id,
  // parsing the "Koppelen aan" select's "kind:id" value. onRefresh (if provided)
  // re-pulls the whole candidate afterwards — Education/Certifications/Languages/
  // Skills all live on a DIFFERENT drawer tab that only remounts from fresh props,
  // so this is what keeps that tab's icons from opening a stale/missing link.
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
  // true. Snapshot + revert on any failure, mirroring rename/removeDoc above.
  const relinkDocument = async (i: number, newLinkTo: string) => {
    const doc = docs[i]
    const id = doc?.id
    setLinkingDoc(null)
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
    setDocs(prev => prev.map((x, j) => j === i ? { ...x, name } : x)); setRenamingDoc(null)
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
  // another row never re-adds the wrong one.
  const removeDoc = (i: number) => {
    const doc = docs[i]
    const id = doc?.id
    // Prune the removed row's selection key too, so a stale key never lingers.
    setSelected(prev => { const next = new Set(prev); next.delete(docKey(doc, i)); return next })
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
  const removeSelected = () => {
    const toRemove = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key))
    setDocs(prev => prev.filter((d, i) => !selected.has(docKey(d, i))))
    setSelected(new Set())
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
  // Runs the staged single/bulk delete once the destructive confirm is accepted.
  const confirmDeleteAction = () => {
    if (confirmDelete?.kind === 'one') removeDoc(confirmDelete.index)
    else if (confirmDelete?.kind === 'many') removeSelected()
    setConfirmDelete(null)
  }
  // File name shown in the single-delete confirm message (empty once the dialog is closed).
  const confirmDeleteName = confirmDelete?.kind === 'one' ? String(docs[confirmDelete.index]?.name ?? docs[confirmDelete.index]?.file_name ?? '') : ''

  // DOC-TYPE-FILTER-1 / NOTES-DOC-FILTER-MENU-1 (Danny 08-08): the document-type
  // filter moved BEHIND the shared DrawerFilterMenu instead of an inline dropdown
  // next to search — filtering behaviour is unchanged, only where it lives changed.
  const filterRows: DrawerFilterConfig[] = docTypes.length > 0 ? [{
    type: 'single', key: 'docType', label: t('documents.type'), value: docTypeFilter, onChange: setDocTypeFilter,
    allLabel: t('documents.allTypes', { defaultValue: 'Alle types' }),
    options: docTypes.map(dt => ({ value: String(dt.value ?? dt.name ?? ''), label: docTypeLabel(String(dt.value ?? dt.name ?? '')) })),
  }] : []

  return (
    <div>
      {/* No "DOCUMENTEN" heading here (Danny 09-08): the tab bar directly above
          already says it, and the customer + vacancy documents tabs never had one
          — this was the odd one out. The toolbar starts with the search box. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        {/* FILTER-WIDTH-1 (Danny 08-08, punt 18 "filter bij documenten is te kort"):
            this search box was the only documents toolbar still on a HARDCODED
            width: 110 — barely room for one word, so a file name could not be
            filtered. It now grows with the row (flex, minWidth floor) at the same
            drill-down footprint the customer + vacancy documents bars already use
            (6/10 padding, radius 8, fontSize 12) — one look, three entities. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 150, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('common:search')}
              aria-label={t('common:search')}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none', flex: 1, minWidth: 0 }} />
            {/* Icon-only control needs a real accessible name (§6) — reuses the shared clear key. */}
            {docSearch && <button onClick={() => setDocSearch('')} title={t('common:clear')} aria-label={t('common:clear')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={12} /></button>}
          </div>
          {/* NOTES-DOC-FILTER-MENU-1 (Danny 08-08): the type filter now lives BEHIND
              this one compact Filter button instead of an inline dropdown — self-
              hides when the tenant has no document types (DrawerFilterMenu renders
              null on empty). */}
          <DrawerFilterMenu filters={filterRows}
            label={t('common:filters.button', { defaultValue: 'Filter' })}
            title={t('common:filters.title')} clearAllLabel={t('common:filters.clearAll')} />
          {/* Soft-tint bulk-download + bulk-delete actions (§4) — only shown once something is
              selected. Point 4: download is a READ action (candidates.view, always available
              here); bulk-delete is a MANAGE action and only renders for a manager. */}
          {selected.size > 0 && (
            <>
              <button onClick={downloadSelected}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary-text)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)' }}>
                <Download size={11} /> {t('documents.downloadSelected', { count: selected.size })}
              </button>
              {canManage && (
                <button onClick={() => setConfirmDelete({ kind: 'many' })}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger-text)',
                    border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
                  <Trash2 size={11} /> {t('documents.deleteSelected', { count: selected.size })}
                </button>
              )}
            </>
          )}
          {/* DRAWER-ADD-SHORT-1 (Danny 05-08): short — always inside a candidate
              drawer sub-tab, never a full page. Point 4: upload is a MANAGE action —
              no fake affordance, the trigger is simply not offered without it. */}
          {canManage && <DrawerAddButton onClick={() => fileRef.current?.click()} label={t('common:add')} short />}
        </div>
      </div>
      <div style={sectionBlock}>
      {/* DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1: the "Koppelen aan" picker lives inside this queue (per file). */}
      {/* REFERENTIE-VELDEN-1 gap closed: references are linkable at upload time too —
          the queue used to omit them while the list row already offered them. */}
      <PendingUploadQueue pending={pending} docTypes={docTypes} educations={educationsForLink} certifications={certificationsForLink}
        languages={languagesForLink} skills={skillsForLink} references={referencesForLink}
        onSetType={setItemType} onSetAllTypes={setAllTypes} onSetLink={setItemLink} onRemove={removePending}
        onUploadAll={uploadAll} onCancel={cancelPending} />
      {docs.length === 0 && pending.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.documentsEmpty')}</div>}
      {docs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
          {/* Select-all operates on the currently filtered, downloadable rows only. */}
          <input type="checkbox" aria-label={t('documents.selectAll')} checked={allFilteredSelected} onChange={toggleSelectAll}
            ref={el => { if (el) el.indeterminate = !allFilteredSelected && filteredDownloadableKeys.some(k => selected.has(k)) }}
            style={{ accentColor: 'var(--color-primary)' }} />
          <span>{t('documents.name')}</span><span>{t('documents.type')}</span><span>{t('documents.size')}</span>
        </div>
      )}
      {filteredDocs.map(d => {
          const i = d._i
          const key = docKey(d, i)
          const downloadable = Boolean(docUrl(d))
          // DOC-LIST-LINK-1: this row's resolved link (chip) + its "kind:id" composite
          // (pre-fills the inline picker's current selection when re-linking).
          const currentLink = resolveDocLink(d)
          return (
            <DocumentRow key={i} d={d} selected={selected.has(key)} downloadable={downloadable}
              onToggleSelect={() => toggleSelectedRow(key)} canManage={canManage}
              renaming={renamingDoc === i} renameValue={renameValue}
              onRenameStart={() => { setRenamingDoc(i); setRenameValue(splitExt(String(d.name ?? d.file_name ?? '')).base) }}
              onRenameChange={setRenameValue}
              onRenameCommit={() => rename(i, renameValue)}
              onRenameCancel={() => setRenamingDoc(null)}
              onReplace={() => { setReplaceTargetId(d.id ?? null); replaceFileRef.current?.click() }}
              onPreview={() => setPreviewDoc(d)}
              onDeleteRequest={() => setConfirmDelete({ kind: 'one', index: i })}
              docColor={docColor} docTypeLabel={docTypeLabel} docTypeIcon={docTypeIcon}
              linked={currentLink} linking={linkingDoc === i} linkValue={currentLink ? `${currentLink.kind}:${currentLink.id}` : ''}
              canLink={hasSelectableEntry(linkableLists, currentLink?.id)} onLinkToggle={() => setLinkingDoc(prev => (prev === i ? null : i))}
              onLinkChange={value => relinkDocument(i, value)}
              educations={educationsForLink} certifications={certificationsForLink} languages={languagesForLink} skills={skillsForLink}
              references={referencesForLink}
            />
          )
        })
      }
      <input ref={fileRef} type="file" style={{ display: 'none' }} multiple
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          // Every picked file becomes its own queue entry (default type 'CV') —
          // this is the actual bugfix: previously only files?.[0] was kept.
          const files = Array.from(e.target.files ?? [])
          if (!files.length) return
          const items: PendingItem[] = files.map(file => ({
            file, objectUrl: URL.createObjectURL(file), name: file.name,
            size: Math.round(file.size / 1024) + ' KB', type: 'CV', linkTo: '',
          }))
          setPending(prev => [...prev, ...items])
          e.target.value = ''
        }} />
      {/* DOC-VERSIE-1 point 3: single-file, hidden — opened per-row via the Replace
          button above; the picked file is sent straight to replaceDoc, never queued. */}
      <input ref={replaceFileRef} type="file" style={{ display: 'none' }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0]
          const targetId = replaceTargetId
          e.target.value = ''
          setReplaceTargetId(null)
          if (file && targetId != null) replaceDoc(targetId, file)
        }} />
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {/* One shared destructive-confirm dialog for both single and bulk delete (never a native confirm()). */}
      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title={t('documents.deleteTitle')}
        message={confirmDelete?.kind === 'many' ? t('documents.deleteManyMessage', { count: selected.size }) : t('documents.deleteOneMessage', { name: confirmDeleteName })}
        confirmLabel={t('common:remove')}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
      </div>
    </div>
  )
}
