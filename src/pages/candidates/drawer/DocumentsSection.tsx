import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, X, FileText, Pencil, Eye } from 'lucide-react'
import api from '@/lib/api'
import { DOC_TYPES, DOC_COLORS, sectionBlock } from './constants'
import DocPreviewModal from './DocPreviewModal'
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
}
interface PendingFile { file: File; objectUrl: string; name: string; size: string }

/** Documents section — owns its own docs state, upload, rename, search and preview.
 * Persists to /candidates/{id}/documents (multipart upload, PATCH rename, DELETE).
 * New rows keep their local blob preview until the server doc (with url) returns. */
export default function DocumentsSection({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const [docs,        setDocs]        = useState<DocItem[]>(c.documents ?? [])
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [pendingType, setPendingType] = useState('CV')
  const [renamingDoc, setRenamingDoc] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [docSearch,   setDocSearch]   = useState('')
  const [previewDoc,  setPreviewDoc]  = useState<DocItem | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Map a stored doc-type value (e.g. 'ID-bewijs') to its translated label.
  const docTypeLabel = (val?: string) => { const m = DOC_TYPES.find((x: { value: string }) => x.value === val); return m ? t(`documents.types.${m.key}`) : val }

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
      .then(r => { const it = r?.data?.data ?? r?.data; if (it?.id) setDocs(d => d.map(x => x.id === tmpId ? { ...optimistic, ...it } : x)) })
      .catch(() => {})
  }

  // Rename / delete persist once the row has a real (positive numeric) id.
  const rename = (i: number, name: string) => {
    const id = docs[i]?.id
    setDocs(docs.map((x, j) => j === i ? { ...x, name } : x)); setRenamingDoc(null)
    if (typeof id === 'number' && id > 0) api.patch(`/candidates/${c.id}/documents/${id}`, { name }).catch(() => {})
  }
  const removeDoc = (i: number) => {
    const id = docs[i]?.id
    setDocs(docs.filter((_, j) => j !== i))
    if (typeof id === 'number' && id > 0) api.delete(`/candidates/${c.id}/documents/${id}`).catch(() => {})
  }

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('sections.documents')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('common:search')}
              style={{ border: 'none', outline: 'none', fontSize: 11, color: 'var(--text)', background: 'none', width: 110 }} />
            {docSearch && <button onClick={() => setDocSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>}
          </div>
          <button onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> {t('common:add')}
          </button>
        </div>
      </div>
      {pendingFile && (
        <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-primary-bg)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            {pendingFile.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pendingFile.size})</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('documents.docType')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {DOC_TYPES.map((dt: { value: string; key: string }) => (
              <button key={dt.value} onClick={() => setPendingType(dt.value)}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: pendingType === dt.value ? 600 : 400,
                  border: `1px solid ${pendingType === dt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: pendingType === dt.value ? 'var(--color-primary)' : 'var(--surface)', color: pendingType === dt.value ? 'white' : 'var(--text)' }}>{t(`documents.types.${dt.key}`)}</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
          <span>{t('documents.name')}</span><span>{t('documents.type')}</span><span>{t('documents.size')}</span>
        </div>
      )}
      {docs.map((d, i) => ({ ...d, _i: i }))
        .filter(d => !docSearch || (d.name ?? d.file_name ?? '').toLowerCase().includes(docSearch.toLowerCase()) || (d.type ?? '').toLowerCase().includes(docSearch.toLowerCase()))
        .map(d => {
          const i = d._i
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: DOC_COLORS[d.type ?? ''] ?? '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={13} color="white" /></div>
                {renamingDoc === i
                  ? <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') rename(i, renameValue); if (e.key === 'Escape') setRenamingDoc(null) }}
                      onBlur={() => rename(i, renameValue)}
                      style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                  : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.file_name}</span>
                }
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: (DOC_COLORS[d.type ?? ''] ?? '#6B7280') + '18', color: DOC_COLORS[d.type ?? ''] ?? '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.size ?? ''}</span>
                <div style={{ display: 'flex' }}>
                  <button onClick={() => { setRenamingDoc(i); setRenameValue(d.name ?? d.file_name ?? '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>
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
  )
}
