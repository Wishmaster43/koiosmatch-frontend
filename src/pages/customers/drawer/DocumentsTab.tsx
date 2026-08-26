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
 */
import { useState, useRef, useId } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Pencil, Eye, Download, Trash2 } from 'lucide-react'
import { useDocumentTypes, resolveDocTypeIcon } from '@/lib/useDocumentTypes'
import { useDateFormat } from '@/lib/datetime'
import { sectionBlock } from '@/components/ui/SectionCard'
// DOCS-LOC-DEPT-1: the same shared picker component the notes composer's
// "gekoppeld aan" level picker uses (§11 — one component, never a fork).
import SelectMenu from '@/components/ui/SelectMenu'
import { useEntityDocuments, type EntityDoc } from '@/hooks/useEntityDocuments'
import { useDocumentLinkPicker } from '../hooks/useDocumentLinkPicker'
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
import { Caption } from '@/components/ui/typography'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'
// §4 soft-tint atoms (herhaal-audit r4, findings 1/2/10): the §4 formula lives
// in lib/tint, and a same-type "pick one to apply to all" chip picker fits the
// shared ChipMultiSelect atom (its "active" set just never grows past one).
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'

// A queued-but-not-yet-uploaded file, each with its own document type (BUGFIX
// 23-07: a multi-file pick used to collapse to a single pending slot, so picking
// 5 files silently uploaded only 1 — now every picked file gets its own queue entry).
interface PendingItem { file: File; objectUrl: string; name: string; size: string; type: string }

// Split a filename into base + extension so rename never touches the extension.
const splitExt = (fn: string) => { const m = fn.match(/\.[^./\\]+$/); return { base: m ? fn.slice(0, -m[0].length) : fn, ext: m ? m[0] : '' } }

// Stable per-row selection key: the real id, or the row index for not-yet-persisted rows.
const docKey = (d: EntityDoc, i: number): string => String(d.id ?? 'idx-' + i)
// A row can be downloaded once the server (or a local blob) has given it a url.
const docUrl = (d: EntityDoc): string | undefined => d.download_url ?? d.objectUrl
// Grid used by both the header row and every data row — one source so they never drift.
const DOC_GRID_COLUMNS = '18px 1fr 80px 100px'

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
  const { formatDate } = useDateFormat()
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
  const [pending,     setPending]     = useState<PendingItem[]>([])
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

  // Send every queued file to the server — one upload() call per item, each with
  // its OWN type — so a multi-file pick uploads all of them, not just the first.
  // DOCS-LOC-DEPT-1: `uploadExtraFields` is only ever spread in when it actually
  // carries something — an unlinked upload keeps calling upload() with exactly
  // its original 4 arguments (never a stray 5th `undefined`).
  const uploadAll = () => {
    if (!pending.length) return
    const items = pending
    setPending([])
    for (const item of items) {
      if (uploadExtraFields) upload(item.file, item.type, item.name, item.objectUrl, uploadExtraFields)
      else upload(item.file, item.type, item.name, item.objectUrl)
    }
    // A fresh upload batch starts unlinked again unless the picker is used once more.
    setUploadLink('customer')
  }
  // Set one item's doc type (its own select) without touching the others.
  const setItemType = (idx: number, type: string) => setPending(items => items.map((it, i) => (i === idx ? { ...it, type } : it)))
  // Apply-to-all chip: set the SAME type on every queued item at once.
  const setAllTypes = (type: string) => setPending(items => items.map(it => ({ ...it, type })))
  // Drop one queued item and revoke its blob preview URL so it never leaks.
  const removePending = (idx: number) => setPending(items => {
    const target = items[idx]
    if (target) URL.revokeObjectURL(target.objectUrl)
    return items.filter((_, i) => i !== idx)
  })
  // Cancel the whole queue: revoke every blob URL, then clear.
  const cancelPending = () => { pending.forEach(p => URL.revokeObjectURL(p.objectUrl)); setPending([]) }

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
          <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-primary-bg)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              {/* Single file keeps the old name+size header; a multi-pick shows a count instead. */}
              {pending.length === 1
                ? <>{pending[0].name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pending[0].size})</span></>
                : t('documents.pendingCount', { count: pending.length })}
            </div>
            <Caption as="div" style={{ marginBottom: 6 }}>
              {pending.length > 1 ? t('documents.applyTypeToAll') : t('documents.docType')}
            </Caption>
            {/* Herhaal-audit r4 finding 10: the shared ChipMultiSelect atom (§4 tint +
                fontWeight 600 + a check mark — CHIP-CONTRAST-1's second signal) reused
                as a "pick one to apply to all" picker: its own "active" set never grows
                past the single type every queued item already shares. selectAll is
                switched off — "select all types" has no meaning here. */}
            <div style={{ marginBottom: 10 }}>
              <ChipMultiSelect options={docTypes} selectAll={false}
                values={pending.length > 0 && pending.every(p => p.type === pending[0].type) ? [pending[0].type] : []}
                onToggle={setAllTypes} ariaLabel={t('documents.applyTypeToAll')} />
            </div>
            {/* DOCS-LOC-DEPT-1: the "gekoppeld aan" level picker — applies to the WHOLE
                queued batch (a batch is normally meant for one place), unlike the
                per-file type select below. Hidden entirely once the scope is locked
                (ScopedDocumentsTab) or the customer has neither a location nor a
                department to link to (§3 — no dead-end picker). */}
            {showLinkPicker && (
              <div style={{ marginBottom: 10 }}>
                <Caption as="div" style={{ marginBottom: 6 }}>{t('documents.linkLevelLabel')}</Caption>
                <div style={{ width: 220 }}>
                  <SelectMenu value={uploadLink} onChange={setUploadLink} options={linkOptions}
                    placeholder={t('notes.linkLevelOptions.customer')} />
                </div>
              </div>
            )}
            {/* One compact row per queued file — its own type select + remove. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {pending.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <Caption style={{ flexShrink: 0 }}>{item.size}</Caption>
                  <span id={`${docTypeLabelBaseId}-${idx}`} className="sr-only">{t('documents.docTypeFor', { name: item.name })}</span>
                  <div style={{ width: 130, flexShrink: 0 }}>
                    <SelectMenu aria-labelledby={`${docTypeLabelBaseId}-${idx}`} value={item.type} onChange={v => setItemType(idx, v)}
                      options={docTypes} menuWidth={160}
                      style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
                  </div>
                  {/* Dense queue-row icon — mirrors the identical unconverted remove
                      button in the candidate drawer's twin PendingUploadQueue.tsx
                      (out of this task's scope); Button's smallest footprint (28px)
                      would tower over this 12px icon in a tightly packed row. Block
                      form: the flagged style attribute sits on the tag's 2nd line. */}
                  {/* eslint-disable huisstijlLegacy/no-restricted-syntax -- see comment above */}
                  <button onClick={() => removePending(idx)} aria-label={t('common:remove')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
                  {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Herhaal-audit r4 finding 2: this is the card's primary action, so it
                  reads Button's own primary identity — a hand-painted inverse fill
                  sitting next to a real Button (cancelPending below) is exactly the
                  drift the audit closes. Wanting the inverse LOOK back is a Button
                  variant to add once, in Button.tsx, never a loose fill in a tab. */}
              <Button variant="primary" size="sm" onClick={uploadAll}>
                {pending.length > 1 ? t('documents.addAll', { count: pending.length }) : t('documents.add')}
              </Button>
              <Button variant="secondary" size="sm" onClick={cancelPending}>{t('drawer.cancel')}</Button>
            </div>
          </div>
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
        {filteredDocs.map(d => {
            const i = d._i
            const key = docKey(d, i)
            const downloadable = Boolean(docUrl(d))
            // The type's own curated icon (fallback FileText) — so rows stand out per type.
            // Optional-chained: older test mocks of useDocumentTypes don't stub iconOf.
            const DocIcon = resolveDocTypeIcon(docTypeIcon?.(d.type))
            return (
            <div key={String(d.id ?? i)} style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
              {/* Row checkbox — disabled while the doc has no downloadable url yet (pending upload). */}
              <input type="checkbox" aria-label={t('documents.selectOne', { name: d.name ?? d.file_name ?? '' })}
                checked={downloadable && selected.has(key)} disabled={!downloadable} onChange={() => toggleSelectedRow(key)}
                style={{ accentColor: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: docColor(d.type), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DocIcon size={13} color="white" /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {renamingId === d.id
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') doRename(d, renameValue); if (e.key === 'Escape') setRenamingId(null) }}
                          onBlur={() => doRename(d, renameValue)}
                          style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                        <Caption style={{ flexShrink: 0 }}>{splitExt(String(d.name ?? d.file_name ?? '')).ext}</Caption>
                      </div>
                    : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.file_name}</span>
                  }
                  {/* DOCS-LOC-DEPT-1: "gekoppeld aan" soft-tint chip (§4) — department wins
                      over location (the deepest level, mirrors CustomerDocument::levelContext()'s
                      own priority); absent entirely for a company-level document. */}
                  {(d.department_name ?? d.location_name) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
                      padding: '1px 6px', borderRadius: 99, marginTop: 2,
                      background: tintBg('var(--color-info)'), color: chipInk('var(--color-info)'),
                      border: tintBorder('var(--color-info)') }}>
                      {t('notes.linkedTo', { name: d.department_name ?? d.location_name })}
                    </span>
                  )}
                  {/* Added by whom + when (shown when the backend provides them). */}
                  {(() => {
                    const by = (typeof d.uploaded_by === 'object' ? d.uploaded_by?.name : d.uploaded_by)
                      ?? (typeof d.created_by === 'object' ? d.created_by?.name : d.created_by) ?? ''
                    const when = d.uploaded_at ?? d.created_at
                    if (!by && !when) return null
                    return <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {by}{by && when ? ' · ' : ''}{when ? formatDate(when, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  })()}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: tintBg(docColor(d.type)), color: chipInk(docColor(d.type)), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                <Caption style={{ whiteSpace: 'nowrap' }}>{d.size ?? ''}</Caption>
                {/* Row-action icon trio — mirrors the byte-identical unconverted row
                    in the candidate drawer's twin DocumentRow.tsx (out of this task's
                    scope): 3× Button's sm footprint (28px) would overflow this fixed
                    100px grid column (DOC_GRID_COLUMNS), which today fits size text +
                    3 dense icons side by side. */}
                <div style={{ display: 'flex' }}>
                  {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
                  <button aria-label={t('common:edit')} onClick={() => { setRenamingId(d.id ?? null); setRenameValue(splitExt(String(d.name ?? d.file_name ?? '')).base) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>
                  {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
                  <button aria-label={t('documents.preview')} onClick={() => preview(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
                  {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
                  <button aria-label={t('common:remove')} onClick={() => setConfirmDelete({ kind: 'one', doc: d, index: i })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>
                </div>
              </div>
            </div>
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
              size: Math.round(file.size / 1024) + ' KB', type: 'CV',
            }))
            setPending(prev => [...prev, ...items])
            e.target.value = ''
          }} />
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
