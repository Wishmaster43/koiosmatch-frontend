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
import { Search, Plus, X, FileText, Pencil, Eye } from 'lucide-react'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
import { useDateFormat } from '@/lib/datetime'
import { sectionBlock } from '@/components/ui/SectionCard'
import { useEntityDocuments, type EntityDoc } from '@/hooks/useEntityDocuments'
import type { Id } from '@/types/common'

interface PendingFile { file: File; objectUrl: string; name: string; size: string }

// Split a filename into base + extension so rename never touches the extension.
const splitExt = (fn: string) => { const m = fn.match(/\.[^./\\]+$/); return { base: m ? fn.slice(0, -m[0].length) : fn, ext: m ? m[0] : '' } }

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
  const fileRef = useRef<HTMLInputElement>(null)

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
              {docTypes.map(dt => (
                <button key={dt.value} onClick={() => setPendingType(dt.value)}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: pendingType === dt.value ? 600 : 400,
                    border: `1px solid ${pendingType === dt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: pendingType === dt.value ? 'var(--color-primary)' : 'var(--surface)', color: pendingType === dt.value ? 'white' : 'var(--text)' }}>{dt.label}</button>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>{t('documents.name')}</span><span>{t('documents.type')}</span><span>{t('documents.size')}</span>
          </div>
        )}
        {docs
          .filter(d => !docSearch || (d.name ?? d.file_name ?? '').toLowerCase().includes(docSearch.toLowerCase()) || (d.type ?? '').toLowerCase().includes(docSearch.toLowerCase()))
          .map((d, i) => (
            <div key={String(d.id ?? i)} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
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
                  <button onClick={() => remove(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>
                </div>
              </div>
            </div>
          ))
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
