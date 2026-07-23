/**
 * DocumentsTab — the customer's documents with upload, type, rename, delete and
 * preview. Data + persistence live in useEntityDocuments (G-3/G-4): the list loads
 * from /customers/{id}/documents and upload/rename/delete are optimistic. Document
 * types come from the tenant /document-types lookup. Preview opens the signed
 * download_url (or the local blob for a not-yet-uploaded row).
 */
import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, X, FileText, Pencil, Eye, Download } from 'lucide-react'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
import { useDateFormat } from '@/lib/datetime'
import { sectionBlock } from '@/components/ui/SectionCard'
import { useEntityDocuments, type EntityDoc } from '@/hooks/useEntityDocuments'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
import type { Id } from '@/types/common'

interface PendingFile { file: File; objectUrl: string; name: string; size: string }

// Split a filename into base + extension so rename never touches the extension.
const splitExt = (fn: string) => { const m = fn.match(/\.[^./\\]+$/); return { base: m ? fn.slice(0, -m[0].length) : fn, ext: m ? m[0] : '' } }

// Stable per-row selection key: the real id, or the row index for not-yet-persisted rows.
const docKey = (d: EntityDoc, i: number): string => String(d.id ?? 'idx-' + i)
// A row can be downloaded once the server (or a local blob) has given it a url.
const docUrl = (d: EntityDoc): string | undefined => d.download_url ?? d.objectUrl
// Grid used by both the header row and every data row — one source so they never drift.
const DOC_GRID_COLUMNS = '18px 1fr 80px 100px'

export default function DocumentsTab({ customerId }: { customerId: Id | undefined }) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
  const { types: docTypes, labelOf: docTypeLabel, colorOf: docColor } = useDocumentTypes()
  // List + optimistic upload/rename/delete against /customers/{id}/documents.
  const { docs, upload, rename, remove } = useEntityDocuments('customers', customerId)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [pendingType, setPendingType] = useState('CV')
  const [renamingId,  setRenamingId]  = useState<Id | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [docSearch,   setDocSearch]   = useState('')
  // Bulk-download selection, keyed by docKey — cleared once a download batch starts.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Send the pending file to the server (an optimistic row appears immediately).
  const doUpload = () => {
    if (!pendingFile) return
    upload(pendingFile.file, pendingType, pendingFile.name, pendingFile.objectUrl)
    setPendingFile(null)
  }

  // Commit a rename: re-attach the original extension, then persist by id.
  const doRename = (d: EntityDoc, base: string) => {
    const cur = String(d.name ?? d.file_name ?? '')
    rename(d.id, base.trim() + splitExt(cur).ext)
    setRenamingId(null)
  }
  // Preview opens the signed capability URL (persisted) or the local blob (pending).
  const preview = (d: EntityDoc) => { const url = d.download_url ?? d.objectUrl; if (url) window.open(url, '_blank', 'noopener,noreferrer') }
  // Remove a doc and prune its selection key too, so a stale key never lingers.
  const doRemove = (d: EntityDoc, i: number) => {
    setSelected(prev => { const next = new Set(prev); next.delete(docKey(d, i)); return next })
    remove(d.id)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('drawer.tabs.documents')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('documents.search')}
              style={{ border: 'none', outline: 'none', fontSize: 11, color: 'var(--text)', background: 'none', width: 110 }} />
            {docSearch && <button onClick={() => setDocSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>}
          </div>
          {/* Soft-tint bulk-download action (§4) — only shown once something is selected. */}
          {selected.size > 0 && (
            <button onClick={downloadSelected}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)' }}>
              <Download size={11} /> {t('documents.downloadSelected', { count: selected.size })}
            </button>
          )}
          <button onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> {t('documents.add')}
          </button>
        </div>
      </div>
      <div style={sectionBlock}>
        {pendingFile && (
          <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-primary-bg)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              {pendingFile.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pendingFile.size})</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('documents.docType')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {/* §4 soft-tint (audit r4): active = tinted, never a solid primary fill. */}
              {docTypes.map(dt => (
                <button key={dt.value} onClick={() => setPendingType(dt.value)}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: pendingType === dt.value ? 600 : 400,
                    border: `1px solid ${pendingType === dt.value ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                    background: pendingType === dt.value ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--surface)',
                    color: pendingType === dt.value ? 'var(--color-primary)' : 'var(--text)' }}>{dt.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doUpload}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--text)', color: 'white', border: 'none', cursor: 'pointer' }}>{t('documents.add')}</button>
              <button onClick={() => { URL.revokeObjectURL(pendingFile.objectUrl); setPendingFile(null) }}
                style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('drawer.cancel')}</button>
            </div>
          </div>
        )}
        {docs.length === 0 && !pendingFile && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.empty')}</div>}
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
            <div key={String(d.id ?? i)} style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
              {/* Row checkbox — disabled while the doc has no downloadable url yet (pending upload). */}
              <input type="checkbox" aria-label={t('documents.selectOne', { name: d.name ?? d.file_name ?? '' })}
                checked={downloadable && selected.has(key)} disabled={!downloadable} onChange={() => toggleSelectedRow(key)}
                style={{ accentColor: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: docColor(d.type), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={13} color="white" /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {renamingId === d.id
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') doRename(d, renameValue); if (e.key === 'Escape') setRenamingId(null) }}
                          onBlur={() => doRename(d, renameValue)}
                          style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{splitExt(String(d.name ?? d.file_name ?? '')).ext}</span>
                      </div>
                    : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.file_name}</span>
                  }
                  {d.created_at && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(d.created_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: docColor(d.type) + '18', color: docColor(d.type), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.size ?? ''}</span>
                <div style={{ display: 'flex' }}>
                  <button onClick={() => { setRenamingId(d.id ?? null); setRenameValue(splitExt(String(d.name ?? d.file_name ?? '')).base) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>
                  <button onClick={() => preview(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
                  <button onClick={() => doRemove(d, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>
                </div>
              </div>
            </div>
            )
          })
        }
        <input ref={fileRef} type="file" style={{ display: 'none' }}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (!file) return
            const objectUrl = URL.createObjectURL(file)
            setPendingFile({ file, objectUrl, name: file.name, size: Math.round(file.size / 1024) + ' KB' })
            setPendingType('CV')
            e.target.value = ''
          }} />
      </div>
    </div>
  )
}
