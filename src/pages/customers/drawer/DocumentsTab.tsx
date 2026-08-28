/**
 * DocumentsTab — the customer's documents with upload, type, rename, delete and
 * preview. Data + persistence live in useEntityDocuments (G-3/G-4): the list loads
 * from /customers/{id}/documents and upload/rename/delete are optimistic. Document
 * types come from the tenant /document-types lookup.
 *
 * PREVIEW FIX (Danny 03-08, translated: "Document preview downloads instead of
 * previewing???" — verbatim: "Preview van documenten is downloaden i.p.v.
 * preview???"): this used to `window.open(download_url)` — a real navigation to a
 * route the backend answers with `Content-Disposition: attachment`
 * (Storage::download), so the browser downloaded the file instead of showing it.
 * The shared DocPreviewModal (moved here from the candidate drawer, §2 — it now
 * serves both entities) opens instead: it fetches the doc as a BLOB, which never
 * triggers the attachment disposition, and renders it in-dialog. The separate
 * "download" bulk/row actions are untouched — they still open the real download route.
 *
 * DOCS-LOC-DEPT-1 (Danny, translated: "you need to know at which level [a
 * document] is linked: CUSTOMER, LOCATION, DEPARTMENT, CONTACT PERSON" —
 * verbatim: "je moet weten op welk niveau [een document] gekoppeld
 * wordt: KLANT, LOCATIE, AFDELING, CONTACTPERSOON"): a document may ALSO hang off
 * one location or one department of this customer — `customer_documents` has no
 * `customer_contact_id` column (measured: EntityDocumentController::store/update
 * only validate customer_location_id/customer_department_id), so unlike notes the
 * upload picker below offers three levels, not four. `locations`/`departments`
 * being passed at all is what enables the picker — ScopedDocumentsTab (the
 * location/department drill-down) instead passes `lockedLevelFields` + `listUrl`
 * and no picker shows: the level is already fixed by which tab you are on.
 *
 * DOCTYPE-SCOPE-1 (audit finding, 05-08): `docTypeScope` (default 'customer') picks
 * WHICH entity-scoped document-type lookup the type chips/picker read — a location/
 * department drill-down now consults its OWN 'customer_location'/'customer_department'
 * lookup (ScopedDocumentsTab passes it) instead of silently reusing the customer's.
 *
 * SPLIT (28-08, mechanical, §3): the upload-queue state/actions moved to
 * hooks/useDocumentUploadQueue, the queued-files card to PendingUploadCard, one
 * document row to DocumentRow, and the tiny pure helpers to hooks/documentsTabUtils
 * — this file now only wires them together and owns selection/rename/delete/preview.
 */
import { useState, useRef, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Download, Trash2 } from 'lucide-react'
import { useDocumentTypes, resolveDocTypeIcon } from '@/lib/useDocumentTypes'
import { useDateFormat } from '@/lib/datetime'
import { sectionBlock } from '@/components/ui/SectionCard'
import { useEntityDocuments, type EntityDoc } from '@/hooks/useEntityDocuments'
import { useDocumentLinkPicker } from '../hooks/useDocumentLinkPicker'
import { useDocumentUploadQueue } from '../hooks/useDocumentUploadQueue'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
// DOC-FILTER-PARITY-1 (08-08): the shared search-box + searchable TYPE filter
// combo the candidate documents section already has — reused here verbatim,
// never forked, so every documents drill-down reads the same (§3A).
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
// House "+ action" trigger (Danny 27-07 consistency sweep) — replaces the bare
// text+Plus button below; same click target (opens the hidden file input).
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import Button from '@/components/ui/Button'
import PendingUploadCard from './PendingUploadCard'
import DocumentRow from './DocumentRow'
import { DOC_GRID_COLUMNS, docKey, docUrl, splitExt } from '../hooks/documentsTabUtils'
import type { Id } from '@/types/common'

interface DocumentsTabProps {
  customerId: Id | undefined
  // DOCS-LOC-DEPT-1: this customer's own locations/departments — presence of
  // either enables the "gekoppeld aan" upload picker below. Omitted (the
  // ScopedDocumentsTab drill-down case) means no picker at all (see file header).
  locations?: { id: Id | undefined; name: string }[]
  departments?: { id: Id | undefined; name: string; locationName?: string }[]
  // ScopedDocumentsTab: overrides the GET listing endpoint (byLocation/byDepartment)
  // and fixes every upload to this level — no picker is offered when this is set.
  listUrl?: string
  lockedLevelFields?: Record<string, string>
  // DOCTYPE-SCOPE-1: which entity-scoped document-type lookup to read — defaults to
  // 'customer' (unchanged behaviour); ScopedDocumentsTab overrides this per level.
  docTypeScope?: string
}

// Customer document manager: list/upload/rename/delete, type filter, and multi-select download; the level (customer/location/department) is driven entirely by props.
export default function DocumentsTab({ customerId, locations = [], departments = [], listUrl, lockedLevelFields, docTypeScope = 'customer' }: DocumentsTabProps) {
  const { t } = useTranslation('customers')
  const { formatDateTime } = useDateFormat()
  // Customer documents offer the customer's own types PLUS the global ones — the backend
  // adds the globals to `?entity=<scope>` itself (null = applies everywhere).
  const { types: docTypes, labelOf: docTypeLabel, colorOf: docColor, iconOf: docTypeIcon } = useDocumentTypes(docTypeScope)
  // List + optimistic upload/rename/delete against /customers/{id}/documents —
  // DOCS-LOC-DEPT-1: `listUrl` overrides the GET endpoint for a scoped drill-down.
  const { docs, upload, rename, remove } = useEntityDocuments('customers', customerId, listUrl)
  // DOCS-LOC-DEPT-1: the upload's "gekoppeld aan" picker state + derived options
  // (own hook, §3 — kept this file from crossing the ~400-line split trigger).
  const { uploadLink, setUploadLink, linkOptions, showLinkPicker, uploadExtraFields } =
    useDocumentLinkPicker(locations, departments, lockedLevelFields)
  // The queued-but-not-yet-uploaded files + every action that touches that queue.
  const { pending, uploadAll, setItemType, setAllTypes, removePending, cancelPending, onFilesPicked } =
    useDocumentUploadQueue({ upload, uploadExtraFields, setUploadLink })
  const [renamingId,  setRenamingId]  = useState<Id | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [docSearch,   setDocSearch]   = useState('')
  // DOC-FILTER-PARITY-1: filter the list by document type, via the house searchable
  // dropdown fed by the tenant document-type lookup — '' = all. Mirrors the candidate
  // documents section's own DOC-TYPE-FILTER-1.
  const [docTypeFilter, setDocTypeFilter] = useState('')
  // Which doc the preview dialog shows — null = closed.
  const [previewDoc,  setPreviewDoc]  = useState<EntityDoc | null>(null)
  // Bulk-download selection, keyed by docKey — cleared once a download batch starts.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Pending delete confirmation — a single row (doc + its resolved index) or the
  // whole bulk selection; nothing is removed until the shared ConfirmDialog is confirmed.
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one'; doc: EntityDoc; index: number } | { kind: 'many' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // G34: base id for the per-queued-file type picker's sr-only label — SelectMenu's
  // trigger is a <button>, so it needs aria-labelledby (never a plain aria-label prop).
  const docTypeLabelBaseId = useId()

  // Rows currently visible under the search filter, with their original index kept.
  // DOC-FILTER-PARITY-1: the type filter narrows further, after the free-text search.
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
  // Flips one row's selection for the bulk-download set.
  const toggleSelectedRow = (key: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }
  // Start the sequential download for every selected doc, in list order, then clear.
  const downloadSelected = async () => {
    const items = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key)).map(({ d }) => ({ url: docUrl(d), name: d.name ?? d.file_name }))
    await downloadFilesSequentially(items)
    setSelected(new Set())
  }

  // Commit a rename: re-attach the original extension, then persist by id.
  const doRename = (d: EntityDoc, base: string) => {
    const cur = String(d.name ?? d.file_name ?? '')
    rename(d.id, base.trim() + splitExt(cur).ext)
    setRenamingId(null)
  }
  // Preview opens the shared modal (blob-fetched in-dialog) — never a raw
  // window.open, which used to trigger a download instead of a preview.
  const preview = (d: EntityDoc) => setPreviewDoc(d)
  // Remove a doc and prune its selection key too, so a stale key never lingers.
  const doRemove = (d: EntityDoc, i: number) => {
    setSelected(prev => { const next = new Set(prev); next.delete(docKey(d, i)); return next })
    remove(d.id)
  }
  // Bulk-delete every selected doc — one remove() call per row (the hook does its
  // own optimistic filter/revert), then clear the selection.
  const removeSelected = () => {
    const toRemove = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key))
    toRemove.forEach(({ d }) => remove(d.id))
    setSelected(new Set())
  }
  // Runs the staged single/bulk delete once the destructive confirm is accepted.
  const confirmDeleteAction = () => {
    if (confirmDelete?.kind === 'one') doRemove(confirmDelete.doc, confirmDelete.index)
    else if (confirmDelete?.kind === 'many') removeSelected()
    setConfirmDelete(null)
  }
  // File name shown in the single-delete confirm message (empty once the dialog is closed).
  const confirmDeleteName = confirmDelete?.kind === 'one' ? String(confirmDelete.doc.name ?? confirmDelete.doc.file_name ?? '') : ''

  // DOC-FILTER-PARITY-1: the type filter row, behind the shared DrawerFilterMenu —
  // self-hides when the tenant has no document types configured for this scope
  // (DrawerFilterMenu renders null on empty).
  const filterRows: DrawerFilterConfig[] = docTypes.length > 0 ? [{
    type: 'single', key: 'docType', label: t('documents.type'), value: docTypeFilter, onChange: setDocTypeFilter,
    allLabel: t('documents.allTypes'),
    options: docTypes.map(dt => ({ value: String(dt.value ?? ''), label: docTypeLabel(String(dt.value ?? '')) })),
  }] : []

  return (
    <div>
      {/* No section title (Danny 05-08, translated: "drop the 'documents' name —
          the tab is already called that" — verbatim: "documenten naam weg —
          tabblad heet al zo"): the
          toolbar starts with the search bar on the LEFT, growing, at the drill-down's
          standard toolbar footprint (6/10 padding, radius 8, fontSize 12 — mirrors the
          Locaties/Kansen search bars). */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('documents.search')}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none', flex: 1, minWidth: 0 }} />
            {/* Inline clear icon inside the 26px search chrome — Button's smallest
                footprint (sm, 28px) would overflow this compact box; mirrors the
                identical unconverted clear button in the shared HeaderSearch atom. */}
            {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact search-chrome icon, not a Button-sized action (see comment above) */}
            {docSearch && <button onClick={() => setDocSearch('')} aria-label={t('common:clear')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>}
          </div>
          {/* DOC-FILTER-PARITY-1: the type filter lives behind this one compact Filter
              button, mirroring the candidate documents section — self-hides when the
              tenant has no document types for this scope. */}
          <DrawerFilterMenu filters={filterRows}
            label={t('common:filters.button')} title={t('common:filters.title')} clearAllLabel={t('common:filters.clearAll')} />
          {/* Bulk-download + bulk-delete actions — herhaal-audit r4 finding 1: the
              §4 soft-tint identity now comes from Button (soft/dangerSoft), never a
              hand-painted color-mix pill — only shown once something is selected. */}
          {selected.size > 0 && (
            <>
              <Button variant="soft" size="sm" onClick={downloadSelected}>
                <Download size={11} /> {t('documents.downloadSelected', { count: selected.size })}
              </Button>
              <Button variant="dangerSoft" size="sm" onClick={() => setConfirmDelete({ kind: 'many' })}>
                <Trash2 size={11} /> {t('documents.deleteSelected', { count: selected.size })}
              </Button>
            </>
          )}
          {/* DRAWER-ADD-SHORT-1 (Danny 05-08): short in this drawer sub-tab's toolbar. */}
          <DrawerAddButton onClick={() => fileRef.current?.click()} label={t('documents.add')} short />
        </div>
      </div>
      <div style={sectionBlock}>
        {pending.length > 0 && (
          <PendingUploadCard
            pending={pending} docTypes={docTypes} docTypeLabelBaseId={docTypeLabelBaseId}
            setItemType={setItemType} setAllTypes={setAllTypes} removePending={removePending}
            uploadAll={uploadAll} cancelPending={cancelPending}
            showLinkPicker={showLinkPicker} uploadLink={uploadLink} setUploadLink={setUploadLink} linkOptions={linkOptions}
          />
        )}
        {docs.length === 0 && pending.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.empty')}</div>}
        {docs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            {/* Select-all operates on the currently filtered, downloadable rows only. */}
            <input type="checkbox" aria-label={t('documents.selectAll')} checked={allFilteredSelected} onChange={toggleSelectAll}
              ref={el => { if (el) el.indeterminate = !allFilteredSelected && filteredDownloadableKeys.some(k => selected.has(k)) }}
              style={{ accentColor: 'var(--color-primary)' }} />
            <span>{t('documents.name')}</span><span>{t('documents.type')}</span><span>{t('documents.size')}</span>
          </div>
        )}
        {filteredDocs.map(d => (
          <DocumentRow key={String(d.id ?? d._i)} doc={d} index={d._i}
            selected={selected} toggleSelectedRow={toggleSelectedRow}
            renamingId={renamingId} renameValue={renameValue} setRenamingId={setRenamingId} setRenameValue={setRenameValue}
            doRename={doRename} docColor={docColor} docTypeLabel={docTypeLabel}
            DocIcon={resolveDocTypeIcon(docTypeIcon?.(d.type))} formatDateTime={formatDateTime}
            preview={preview} onDelete={(doc, index) => setConfirmDelete({ kind: 'one', doc, index })}
          />
        ))}
        <input ref={fileRef} type="file" style={{ display: 'none' }} multiple onChange={onFilesPicked} />
        {/* The shared preview dialog reads the SAME docTypeScope so the type chip
            resolves against this level's own document-type lookup, never a
            hardcoded 'customer' once a location/department has its own scope. */}
        {previewDoc && <DocPreviewModal doc={previewDoc} docTypeScope={docTypeScope} onClose={() => setPreviewDoc(null)} />}
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
