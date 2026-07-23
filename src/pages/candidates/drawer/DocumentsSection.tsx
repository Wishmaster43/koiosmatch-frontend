import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, FileText, Pencil, Eye, Download } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { sectionBlock } from './constants'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
import { useDateFormat } from '@/lib/datetime'
import { downloadFilesSequentially } from '@/lib/downloadFiles'
import DocPreviewModal from './DocPreviewModal'
import DrawerAddButton from './DrawerAddButton'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

interface DocItem {
  id?: Id
  name?: string
  file_name?: string
  size?: string | number
  type?: string
  objectUrl?: string
  url?: string
  created_at?: string
  uploaded_at?: string
  uploaded_by?: string | { name?: string }
  created_by?: string | { name?: string }
}

// Split a filename into base + extension so rename never touches the extension.
const splitExt = (fn: string) => { const m = fn.match(/\.[^./\\]+$/); return { base: m ? fn.slice(0, -m[0].length) : fn, ext: m ? m[0] : '' } }
interface PendingFile { file: File; objectUrl: string; name: string; size: string }

// Stable per-row selection key: the real id, or the row index for not-yet-persisted rows.
const docKey = (d: DocItem, i: number): string => String(d.id ?? 'idx-' + i)
// A row can be downloaded once the server (or a local blob) has given it a url.
const docUrl = (d: DocItem): string | undefined => d.url ?? d.objectUrl
// Grid used by both the header row and every data row — one source so they never drift.
const DOC_GRID_COLUMNS = '18px 1fr 80px 100px'

/** Documents section — owns its own docs state, upload, rename, search and preview.
 * Persists to /candidates/{id}/documents (multipart upload, PATCH rename, DELETE).
 * New rows keep their local blob preview until the server doc (with url) returns. */
export default function DocumentsSection({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Document types + colours from the tenant lookup (seed fallback until /document-types lands).
  const { types: docTypes, labelOf: docTypeLabel, colorOf: docColor } = useDocumentTypes()
  const [docs,        setDocs]        = useState<DocItem[]>(c.documents ?? [])
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [pendingType, setPendingType] = useState('CV')
  const [renamingDoc, setRenamingDoc] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [docSearch,   setDocSearch]   = useState('')
  const [previewDoc,  setPreviewDoc]  = useState<DocItem | null>(null)
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

  // Upload the pending file (multipart) and optimistically show it right away.
  const upload = () => {
    if (!pendingFile) return
    const tmpId = -Date.now()
    const optimistic: DocItem = { id: tmpId, name: pendingFile.name, size: pendingFile.size, type: pendingType, objectUrl: pendingFile.objectUrl }
    setDocs(d => [...d, optimistic])
    const fd = new FormData()
    fd.append('file', pendingFile.file); fd.append('type', pendingType); fd.append('name', pendingFile.name)
    setPendingFile(null)
    api.post(`/candidates/${c.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => { const it = unwrap<DocItem>(r); if (it?.id) setDocs(d => d.map(x => x.id === tmpId ? { ...optimistic, ...it } : x)) })
      .catch(() => notifyError(t('common:actionFailed')))
  }

  // Rename / delete persist once the row has a real (positive numeric) id.
  const rename = (i: number, base: string) => {
    const id = docs[i]?.id
    // Re-append the original extension — only the name part is editable.
    const cur = String(docs[i]?.name ?? docs[i]?.file_name ?? '')
    const name = base.trim() + splitExt(cur).ext
    setDocs(docs.map((x, j) => j === i ? { ...x, name } : x)); setRenamingDoc(null)
    if (typeof id === 'number' && id > 0) api.patch(`/candidates/${c.id}/documents/${id}`, { name }).catch(() => notifyError(t('common:actionFailed')))
  }
  const removeDoc = (i: number) => {
    const id = docs[i]?.id
    // Prune the removed row's selection key too, so a stale key never lingers.
    setSelected(prev => { const next = new Set(prev); next.delete(docKey(docs[i], i)); return next })
    setDocs(docs.filter((_, j) => j !== i))
    if (typeof id === 'number' && id > 0) api.delete(`/candidates/${c.id}/documents/${id}`).catch(() => notifyError(t('common:actionFailed')))
  }

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
          {/* Soft-tint bulk-download action (§4) — only shown once something is selected. */}
          {selected.size > 0 && (
            <button onClick={downloadSelected}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)' }}>
              <Download size={11} /> {t('documents.downloadSelected', { count: selected.size })}
            </button>
          )}
          <DrawerAddButton onClick={() => fileRef.current?.click()} label={t('common:add')} />
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
            <button onClick={upload}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--text)', color: 'white', border: 'none', cursor: 'pointer' }}>{t('common:add')}</button>
            <button onClick={() => { URL.revokeObjectURL(pendingFile.objectUrl); setPendingFile(null) }}
              style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:cancel')}</button>
          </div>
        </div>
      )}
      {docs.length === 0 && !pendingFile && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.documentsEmpty')}</div>}
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
            <div key={i} style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
              {/* Row checkbox — disabled while the doc has no downloadable url yet (pending upload). */}
              <input type="checkbox" aria-label={t('documents.selectOne', { name: d.name ?? d.file_name ?? '' })}
                checked={downloadable && selected.has(key)} disabled={!downloadable} onChange={() => toggleSelectedRow(key)}
                style={{ accentColor: 'var(--color-primary)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: docColor(d.type), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={13} color="white" /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {renamingDoc === i
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') rename(i, renameValue); if (e.key === 'Escape') setRenamingDoc(null) }}
                          onBlur={() => rename(i, renameValue)}
                          style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                        {/* Extension shown but not editable. */}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{splitExt(String(d.name ?? d.file_name ?? '')).ext}</span>
                      </div>
                    : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.file_name}</span>
                  }
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
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: docColor(d.type) + '18', color: docColor(d.type), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.size ?? ''}</span>
                <div style={{ display: 'flex' }}>
                  <button onClick={() => { setRenamingDoc(i); setRenameValue(splitExt(String(d.name ?? d.file_name ?? '')).base) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>
                  <button onClick={() => setPreviewDoc(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
                  <button onClick={() => removeDoc(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>
                </div>
              </div>
            </div>
          )
        })
      }
      <input ref={fileRef} type="file" style={{ display: 'none' }} multiple
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0]
          if (!file) return
          const objectUrl = URL.createObjectURL(file)
          setPendingFile({ file, objectUrl, name: file.name, size: Math.round(file.size / 1024) + ' KB' })
          setPendingType('CV')
          e.target.value = ''
        }} />
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      </div>
    </div>
  )
}
