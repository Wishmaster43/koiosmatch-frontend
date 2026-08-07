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
import DrawerAddButton from './DrawerAddButton'
import PendingUploadQueue from './PendingUploadQueue'
import type { PendingItem } from './PendingUploadQueue'
import DocumentRow from './DocumentRow'
import { docKey, isPersisted, docUrl, splitExt, DOC_GRID_COLUMNS } from './documentHelpers'
import type { DocItem } from './documentHelpers'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// DOC-ENTRY-LINK-1 / DOC-LANG-SKILL-LINK-1: maps the "Koppelen aan" picker's
// "kind:id" prefix to its API relation segment — module scope, never rebuilt per render.
const RELATION_BY_LINK_KIND: Record<string, string> = { education: 'educations', certification: 'certifications', language: 'languages', skill: 'skills' }

/** Documents section — owns its own docs state, upload, rename, search and preview.
 * Persists to /candidates/{id}/documents (multipart upload, PATCH rename, DELETE,
 * POST .../replace). New rows keep their local blob preview until the server doc
 * (with url) returns. Row rendering lives in DocumentRow (§3 size discipline);
 * this file owns the state + every persistence path. */
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
  const educationsForLink = (c.educations ?? []) as Array<{ id?: Id; title?: string }>
  const certificationsForLink = (c.certifications ?? []) as Array<{ id?: Id; name?: string }>
  // DOC-LANG-SKILL-LINK-1: same picker, extended to languages/skills (BE landed
  // document_id on candidate_languages + candidate_skills, mirrors DOC-EDU-1
  // exactly). Filtered to entries with a real id — a legacy plain-string skill
  // or a not-yet-persisted row has nothing a PATCH could target.
  const languagesForLink = ((c.languages ?? []) as Array<{ id?: Id; language?: string; name?: string }>).filter(l => l.id != null)
  const skillsForLink = (((c.skills ?? []) as unknown) as Array<{ id?: Id; name?: string }>).filter(s => s?.id != null)
  const [docs,        setDocs]        = useState<DocItem[]>(c.documents ?? [])
  const [pending,      setPending]     = useState<PendingItem[]>([])
  const [renamingDoc, setRenamingDoc] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [docSearch,   setDocSearch]   = useState('')
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
    api.patch(`/candidates/${c.id}/${relation}/${entryId}`, { document_id: documentId })
      .then(() => onRefresh?.())
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
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
            setDocs(d => d.map(x => x.id === tmpId ? { ...optimistic, ...it } : x))
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
        if (it) setDocs(prev => prev.map(x => x.id === id ? { ...x, ...it } : x))
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('sections.documents')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('common:search')}
              style={{ border: 'none', outline: 'none', fontSize: 11, color: 'var(--text)', background: 'none', width: 110 }} />
            {docSearch && <button onClick={() => setDocSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>}
          </div>
          {/* Soft-tint bulk-download + bulk-delete actions (§4) — only shown once something is
              selected. Point 4: download is a READ action (candidates.view, always available
              here); bulk-delete is a MANAGE action and only renders for a manager. */}
          {selected.size > 0 && (
            <>
              <button onClick={downloadSelected}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)' }}>
                <Download size={11} /> {t('documents.downloadSelected', { count: selected.size })}
              </button>
              {canManage && (
                <button onClick={() => setConfirmDelete({ kind: 'many' })}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)',
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
      <PendingUploadQueue pending={pending} docTypes={docTypes} educations={educationsForLink} certifications={certificationsForLink}
        languages={languagesForLink} skills={skillsForLink}
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
