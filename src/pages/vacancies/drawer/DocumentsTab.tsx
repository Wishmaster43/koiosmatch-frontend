import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Download, Trash2 } from 'lucide-react'
import type { VacancyDetail } from '@/types/vacancy'
import { useEntityDocuments } from '@/hooks/useEntityDocuments'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
// PDF-VACATURES-26: the vacancy documents list now uses the SAME row component the
// candidate documents section renders (never a second, forked row) — mirrors the
// S-vacapp-1 precedent in ApplicantsTab.tsx (this drawer already reuses the
// candidate drawer's ApplicationRow for the same "one shape everywhere" reason).
// DocumentRow's linking cluster (education/certification/language/skill/reference)
// is a CANDIDATE-only axis — the vacancy has none of those, so every linkable list
// below is passed empty and `canLink` false, which makes DocumentRow render no link
// controls at all (never a dead "koppelen" button). `canReplace={false}` for the
// same reason: there is no /vacancies/{id}/documents/{id}/replace route yet
// (reported in skipped, not silently wired to a 404).
import { DocumentRow } from '@/pages/candidates/shared'
import { docKey, docUrl, splitExt, DOC_GRID_COLUMNS } from '@/pages/candidates/shared'
import type { DocItem } from '@/pages/candidates/shared'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
// HUISSTIJL-1: the doc-type hint line (11px/muted) is the shared Caption atom.
import { Caption } from '@/components/ui/typography'

// Hoisted: an inline accent literal under background: false-fires the accent-fill selector.
const ACCENT = 'var(--color-primary)'

// A picked-but-not-yet-uploaded file, staged so its type can be chosen first.
interface PendingDoc { file: File; objectUrl: string; name: string; size: string; type: string }

/**
 * DocumentsTab — list + upload + rename + preview + single/bulk download + single/
 * bulk delete for a vacancy's documents. Data + persistence live in
 * useEntityDocuments (G-4): the list loads from /vacancies/{id}/documents and
 * upload/rename/delete are optimistic.
 *
 * PDF-VACATURES-26 (this pass): brought onto the SAME DocumentRow the candidate
 * documents section renders — rename (pencil), a real download icon per row,
 * preview (DocPreviewModal, shared), and bulk select → download-all/delete-all —
 * closing the parity gap with the candidate section. No "koppelen" step exists
 * here (never did) — the vacancy has nothing analogous to a candidate's education/
 * certification/language/skill/reference to link a document to.
 *
 * DOCTYPE-VACANCY-1 (audit finding, 05-08): uploads used to always POST an empty
 * `type` — the tenant document-type lookup, scoped 'vacancy' (DOCTYPE-ENTITY-1), now
 * offers a soft-tint chip picker before the upload confirms, and each row shows its
 * resolved type. Kept to ONE queued file at a time — this tab never supported a
 * multi-pick queue, unlike the candidate section's richer multi-file version.
 */
export default function DocumentsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { docs, loading, error, upload, rename, remove } = useEntityDocuments('vacancies', v.id)
  // Vacancy's own document-type lookup (entity-scoped) — never a hardcoded list.
  const { types: docTypes, labelOf: docTypeLabel, colorOf: docColor, iconOf: docTypeIcon } = useDocumentTypes('vacancy')
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingDoc | null>(null)
  // DOC-FILTER-PARITY-1: free-text search (name + type) and the type filter, mirroring
  // the candidate documents section's own filtering exactly.
  const [docSearch, setDocSearch] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('')
  // Row-level state: rename-in-progress, preview and the pending delete confirmation
  // (single row or the whole bulk selection) — mirrors DocumentsSection exactly.
  const [renamingDoc, setRenamingDoc] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one'; index: number } | { kind: 'many' } | null>(null)
  // Tracks the blob: URL of the currently staged preview, so it can be revoked when
  // replaced/cancelled/uploaded and on unmount — mirrors EntityHeader's PhotoAvatar /
  // useProfileForm fix (same class of leak: a preview created with URL.createObjectURL
  // that only ever got revoked on the happy "cancel" path, never on replace or unmount).
  const pendingUrlRef = useRef<string | null>(null)

  // Revoke a still-staged preview on unmount (drawer closed with a queued, unconfirmed
  // file) — reads the ref at cleanup time, so it always sees the latest staged URL.
  useEffect(() => () => { if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current) }, [])

  // Stage the picked file instead of uploading it blind — default type = the
  // tenant's first configured value, so the chip row always shows a selection.
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke the previous staged preview (if any) before replacing it — picking again
    // without confirming/cancelling first used to leak the earlier blob URL.
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
    const objectUrl = URL.createObjectURL(file)
    pendingUrlRef.current = objectUrl
    setPending({ file, objectUrl, name: file.name, size: Math.round(file.size / 1024) + ' KB', type: docTypes[0]?.value ?? '' })
    e.target.value = ''
  }
  // Confirm the staged file — upload with its picked type, then clear the queue.
  // Ownership of the object URL passes to useEntityDocuments (it revokes it once the
  // server doc replaces the optimistic row), so the ref is cleared WITHOUT revoking here.
  const confirmUpload = () => {
    if (!pending) return
    upload(pending.file, pending.type, pending.name, pending.objectUrl)
    pendingUrlRef.current = null
    setPending(null)
  }
  // Cancel discards the queued file and revokes its blob preview URL.
  const cancelUpload = () => {
    if (pending) URL.revokeObjectURL(pending.objectUrl)
    pendingUrlRef.current = null
    setPending(null)
  }

  // DOC-FILTER-PARITY-1: search matches name + type; the type filter narrows further —
  // mirrors the candidate documents section's own filtering logic exactly. `_i` keeps
  // the row's index into the unfiltered `docs` so rename/delete/select always target
  // the right record even while a filter is active.
  const filteredDocs = docs.map((d, i) => ({ ...d, _i: i }))
    .filter(d => (!docSearch || (d.name ?? '').toLowerCase().includes(docSearch.toLowerCase()) || (d.type ?? '').toLowerCase().includes(docSearch.toLowerCase())) &&
      (!docTypeFilter || (d.type ?? '') === docTypeFilter))
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
  // Row-level checkbox toggle for the multi-select download; independent of the select-all above, which acts on the whole filtered set at once.
  const toggleSelectedRow = (key: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }
  // Start the sequential download for every selected doc, in list order, then clear.
  const downloadSelected = async () => {
    const items = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key)).map(({ d }) => ({ url: docUrl(d), name: d.name }))
    await downloadFilesSequentially(items)
    setSelected(new Set())
  }

  // Rename persists via useEntityDocuments' own optimistic rename (it owns `docs`,
  // so this component never keeps a second copy of the list to reconcile).
  const doRename = (i: number, base: string) => {
    const doc = docs[i]
    const cur = String(doc?.name ?? '')
    const name = base.trim() + splitExt(cur).ext
    setRenamingDoc(null)
    rename(doc?.id, name)
  }
  // Single-row delete, resolved by index so a filtered view still targets the right row.
  const removeDoc = (i: number) => {
    const doc = docs[i]
    setSelected(prev => { const next = new Set(prev); next.delete(docKey(doc, i)); return next })
    remove(doc?.id)
  }
  // Bulk-delete every selected, downloadable doc — one DELETE per row via the shared hook.
  const removeSelected = () => {
    const toRemove = docs.map((d, i) => ({ d, key: docKey(d, i) })).filter(({ key }) => selected.has(key))
    setSelected(new Set())
    toRemove.forEach(({ d }) => remove(d.id))
  }
  // Runs the staged single/bulk delete once the destructive confirm is accepted.
  const confirmDeleteAction = () => {
    if (confirmDelete?.kind === 'one') removeDoc(confirmDelete.index)
    else if (confirmDelete?.kind === 'many') removeSelected()
    setConfirmDelete(null)
  }
  const confirmDeleteName = confirmDelete?.kind === 'one' ? String(docs[confirmDelete.index]?.name ?? '') : ''

  // The type filter row, behind the shared DrawerFilterMenu — self-hides when the
  // tenant has no document types configured (DrawerFilterMenu renders null on empty).
  const filterRows: DrawerFilterConfig[] = docTypes.length > 0 ? [{
    type: 'single', key: 'docType', label: t('documents.type'), value: docTypeFilter, onChange: setDocTypeFilter,
    allLabel: t('documents.allTypes'),
    options: docTypes.map(dt => ({ value: String(dt.value ?? ''), label: docTypeLabel(String(dt.value ?? '')) })),
  }] : []

  // No linkable entries on a vacancy (the link cluster is a candidate-only axis) —
  // passed through unconditionally so DocumentRow renders no link controls at all.
  const noLinkables: never[] = []

  return (
    <div>
      {/* DOC-FILTER-PARITY-1: no more inline section title (the drawer's own tab bar
          already labels this tab "Documents", so a duplicate title read as clutter —
          mirrors the customer DocumentsTab, which dropped it for the same reason).
          Search grows on the left; the filter menu, bulk actions and Add button sit flush right. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', flex: 1, minWidth: 0 }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('documents.search')}
            aria-label={t('documents.search')}
            style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none', flex: 1, minWidth: 0 }} />
          {/* Search-clear glyph keeps its flush footprint (mirrors the shared search-chrome precedent). */}
          {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- 11px inline clear glyph inside the search chrome, not a Button copy */}
          {docSearch && <button onClick={() => setDocSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>}
        </div>
        <DrawerFilterMenu filters={filterRows}
          label={t('common:filters.button')} title={t('common:filters.title')} clearAllLabel={t('common:filters.clearAll')} />
        {/* PDF-VACATURES-26: bulk download/delete — same soft-tint pills the candidate
            documents section shows, only rendered once something is selected. */}
        {selected.size > 0 && (
          <>
            {/* r4 finding 1's twin (customers DocumentsTab converted the same round):
                the bulk pills are house Buttons, never hand-rolled tints. */}
            <Button variant="soft" size="sm" onClick={downloadSelected} style={{ flexShrink: 0 }}>
              <Download size={11} /> {t('documents.downloadSelected', { count: selected.size, defaultValue: 'Download ({{count}})' })}
            </Button>
            <Button variant="dangerSoft" size="sm" onClick={() => setConfirmDelete({ kind: 'many' })} style={{ flexShrink: 0 }}>
              <Trash2 size={11} /> {t('documents.deleteSelected', { count: selected.size, defaultValue: 'Delete ({{count}})' })}
            </Button>
          </>
        )}
        {/* V16 (05-08): the house control keeps the same click target (the hidden
            <input type="file"> below) and the full "Add" label as its title/aria-label,
            short-form visible text per the sub-tab rule. */}
        <DrawerAddButton onClick={() => fileRef.current?.click()} label={t('common:add')} short />
      </div>

      {pending && (
        <div style={{ border: '1px solid var(--color-primary)', borderRadius: 8, padding: 10, marginBottom: 8, background: 'var(--color-primary-bg)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {pending.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pending.size})</span>
          </div>
          <Caption as="div" style={{ marginBottom: 6 }}>{t('documents.docType')}</Caption>
          {/* Choice-chips (CHIP-TINT-1): the lib/tint house pair + chipInk — was a
              hand-rolled 14/45 pair with RAW accent ink. Block form: the style
              attr spans the tag. */}
          {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {docTypes.map(dt => {
              const active = pending.type === dt.value
              return (
                <button key={dt.value} onClick={() => setPending(p => (p ? { ...p, type: dt.value } : p))}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: active ? 600 : 400,
                    border: active ? tintBorder(ACCENT, true) : '1px solid var(--border)',
                    background: active ? tintBg(ACCENT, true) : 'var(--surface)',
                    color: active ? chipInk(ACCENT) : 'var(--text)' }}>{dt.label}</button>
              )
            })}
          </div>
          {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Herhaal-audit r4 finding 2's twin (customers DocumentsTab converted
                the same round): the inverse --text fill is retired — the card's
                primary action wears the house Button. */}
            <Button variant="primary" size="sm" onClick={confirmUpload}>
              {t('common:add')}
            </Button>
            <Button variant="secondary" size="sm" onClick={cancelUpload}>
              {t('common:cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* L8-docs-1: four explicit UI states (§3) — loading/error/empty/success,
          a failed fetch must never silently read as "no documents". */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.loading')}</div>
      ) : error ? (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('documents.loadFailed')}</div>
      ) : docs.length === 0 && !pending ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.empty')}</div>
      ) : filteredDocs.length === 0 ? (
        // A filter/search with zero matches is distinct from "no documents at all".
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.noResults')}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            {/* Select-all operates on the currently filtered, downloadable rows only. */}
            <input type="checkbox" aria-label={t('common:selectAll', { defaultValue: 'Select all' })} checked={allFilteredSelected} onChange={toggleSelectAll}
              ref={el => { if (el) el.indeterminate = !allFilteredSelected && filteredDownloadableKeys.some(k => selected.has(k)) }}
              style={{ accentColor: 'var(--color-primary)' }} />
            <span>{t('documents.name', { defaultValue: 'Name' })}</span><span>{t('documents.type')}</span><span>{t('documents.size', { defaultValue: 'Size' })}</span>
          </div>
          {filteredDocs.map(d => {
            const i = d._i
            const key = docKey(d, i)
            const downloadable = Boolean(docUrl(d))
            return (
              <DocumentRow key={i} d={d} selected={selected.has(key)} downloadable={downloadable}
                onToggleSelect={() => toggleSelectedRow(key)} canManage
                renaming={renamingDoc === i} renameValue={renameValue}
                onRenameStart={() => { setRenamingDoc(i); setRenameValue(splitExt(String(d.name ?? '')).base) }}
                onRenameChange={setRenameValue}
                onRenameCommit={() => doRename(i, renameValue)}
                onRenameCancel={() => setRenamingDoc(null)}
                onReplace={() => {}} canReplace={false}
                onPreview={() => setPreviewDoc(d)}
                onDeleteRequest={() => setConfirmDelete({ kind: 'one', index: i })}
                docColor={docColor} docTypeLabel={docTypeLabel} docTypeIcon={docTypeIcon}
                linked={null} linking={false} linkValue="" canLink={false} onLinkToggle={() => {}} onLinkChange={() => {}}
                educations={noLinkables} certifications={noLinkables} languages={noLinkables} skills={noLinkables} references={noLinkables}
              />
            )
          })}
        </>
      )}

      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onPick} />
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title={t('documents.deleteTitle', { defaultValue: 'Delete document' })}
        message={confirmDelete?.kind === 'many'
          ? t('documents.deleteManyMessage', { count: selected.size, defaultValue: 'Delete {{count}} selected documents?' })
          : t('documents.deleteOneMessage', { name: confirmDeleteName, defaultValue: 'Delete "{{name}}"?' })}
        confirmLabel={t('common:remove')}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
