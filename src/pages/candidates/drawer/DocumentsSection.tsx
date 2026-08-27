/**
 * DocumentsSection — the candidate drawer's Documents tab: upload, rename,
 * search, preview, per-row link-to-entry (education/certification/language/
 * skill/reference), bulk download/delete. Every persistence path (upload,
 * rename, replace, delete, bulk delete, re-link) against
 * /candidates/{id}/documents lives in useCandidateDocuments — this file owns
 * the search/filter/selection UI state and renders DocumentRow (§3 size
 * discipline: dumb row renderer + a thin container).
 */
import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Download, Trash2 } from 'lucide-react'
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
import { hasSelectableEntry } from './documentLinkRules'
import { docKey, docUrl, splitExt, DOC_GRID_COLUMNS } from './documentHelpers'
import type { DocItem } from './documentHelpers'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useCandidateDocuments } from './hooks/useCandidateDocuments'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

/** Documents section — search/filter/selection UI state; every persistence
 * path (upload, rename, replace, delete, bulk delete, re-link) lives in
 * useCandidateDocuments. New rows keep their local blob preview until the
 * server doc (with url) returns. Row rendering lives in DocumentRow (§3 size
 * discipline).
 * DOC-LIST-LINK-1 (Danny 08-08): the list row also shows + changes the document's
 * link to an education/certification/language/skill/reference (the upload-time
 * "Koppelen aan" ("Link to") pick was write-only before this — no trace of it
 * showed in the list, and there was no way to change or remove it). See
 * resolveDocLink/relinkDocument (in the hook). */
export default function DocumentsSection({ c, onRefresh }: { c: Candidate; onRefresh?: () => void }) {
  const { t } = useTranslation('candidates')
  // Point 4: every MANAGE action (upload/rename/replace/delete) gates on this
  // permission; read + download stay available under the drawer's own
  // candidates.view gate (unaffected here — never double-gated).
  const canManage = useAuth()?.hasPermission('candidates.documents.manage') ?? false
  // Document types + colours + icons from the tenant lookup (seed fallback until /document-types lands).
  // Candidate documents: this entity's types plus the global ones (see DocumentsTab).
  const { types: docTypes, labelOf: docTypeLabel, colorOf: docColor, iconOf: docTypeIcon } = useDocumentTypes('candidate')
  // Every persistence path (upload/rename/replace/delete/bulk-delete/re-link) +
  // the derived link-candidate lists live in this one hook.
  const {
    docs, pending, setPending,
    educationsForLink, certificationsForLink, languagesForLink, skillsForLink, referencesForLink, linkableLists,
    uploadAll, setItemType, setAllTypes, setItemLink, removePending, cancelPending,
    replaceDoc, rename, removeDoc, removeSelected, relinkDocument, resolveDocLink,
  } = useCandidateDocuments(c, onRefresh)
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
  // Flips one row's selection for the bulk-download picker.
  const toggleSelectedRow = (key: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }
  // Start the sequential download for every selected doc, in list order, then clear.
  const downloadSelected = async () => {
    const items = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key)).map(({ d }) => ({ url: docUrl(d), name: d.name ?? d.file_name }))
    await downloadFilesSequentially(items)
    setSelected(new Set())
  }

  // Runs the staged single/bulk delete once the destructive confirm is accepted.
  const confirmDeleteAction = () => {
    if (confirmDelete?.kind === 'one') {
      // Prune the removed row's selection key too, so a stale key never lingers.
      removeDoc(confirmDelete.index, key => setSelected(prev => { const next = new Set(prev); next.delete(key); return next }))
    } else if (confirmDelete?.kind === 'many') {
      removeSelected(selected)
      setSelected(new Set())
    }
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
      {/* No "DOCUMENTEN" ("DOCUMENTS") heading here (Danny 09-08): the tab bar directly above
          already says it, and the customer + vacancy documents tabs never had one
          — this was the odd one out. The toolbar starts with the search box. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        {/* FILTER-WIDTH-1 (Danny 08-08, point 18, verbatim: "filter bij documenten
            is te kort" — i.e. "the filter next to documents is too short"):
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
          {/* FROZEN DEBT (huisstijl ceiling entry 8, unchanged by this split): these
              two hand-painted buttons are the measured exception carried over from
              the pre-split file — see scripts/huisstijl-ceiling.json. Soft-tint
              bulk-download + bulk-delete actions (§4) — only shown once something is
              selected. Point 4: download is a READ action (candidates.view, always
              available here); bulk-delete is a MANAGE action and only renders for a
              manager. */}
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
              onRenameCommit={() => { rename(i, renameValue); setRenamingDoc(null) }}
              onRenameCancel={() => setRenamingDoc(null)}
              onReplace={() => { setReplaceTargetId(d.id ?? null); replaceFileRef.current?.click() }}
              onPreview={() => setPreviewDoc(d)}
              onDeleteRequest={() => setConfirmDelete({ kind: 'one', index: i })}
              docColor={docColor} docTypeLabel={docTypeLabel} docTypeIcon={docTypeIcon}
              linked={currentLink} linking={linkingDoc === i} linkValue={currentLink ? `${currentLink.kind}:${currentLink.id}` : ''}
              canLink={hasSelectableEntry(linkableLists, currentLink?.id)} onLinkToggle={() => setLinkingDoc(prev => (prev === i ? null : i))}
              onLinkChange={value => { relinkDocument(i, value); setLinkingDoc(null) }}
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
