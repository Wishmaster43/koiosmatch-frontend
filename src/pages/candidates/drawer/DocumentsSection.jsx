import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, X, FileText, Pencil, Eye } from 'lucide-react'
import { DOC_TYPES, DOC_COLORS, sectionBlock } from './constants'
import DocPreviewModal from './DocPreviewModal'

/** Documents section — owns its own docs state, upload, rename, search and preview. */
export default function DocumentsSection({ c }) {
  const { t } = useTranslation('candidates')
  const [docs,        setDocs]        = useState(c.documents ?? [])
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingType, setPendingType] = useState('CV')
  const [renamingDoc, setRenamingDoc] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [docSearch,   setDocSearch]   = useState('')
  const [previewDoc,  setPreviewDoc]  = useState(null)
  const fileRef = useRef(null)

  // Map a stored doc-type value (e.g. 'ID-bewijs') to its translated label.
  const docTypeLabel = (val) => { const m = DOC_TYPES.find(x => x.value === val); return m ? t(`documents.types.${m.key}`) : val }

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
            {DOC_TYPES.map(dt => (
              <button key={dt.value} onClick={() => setPendingType(dt.value)}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: pendingType === dt.value ? 600 : 400,
                  border: `1px solid ${pendingType === dt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: pendingType === dt.value ? 'var(--color-primary)' : 'white', color: pendingType === dt.value ? 'white' : 'var(--text)' }}>{t(`documents.types.${dt.key}`)}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setDocs([...docs, { name: pendingFile.name, size: pendingFile.size, type: pendingType, objectUrl: pendingFile.objectUrl }]); setPendingFile(null) }}
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
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: DOC_COLORS[d.type] ?? '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={13} color="white" /></div>
                {renamingDoc === i
                  ? <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { setDocs(docs.map((x, j) => j === i ? { ...x, name: renameValue } : x)); setRenamingDoc(null) } if (e.key === 'Escape') setRenamingDoc(null) }}
                      onBlur={() => { setDocs(docs.map((x, j) => j === i ? { ...x, name: renameValue } : x)); setRenamingDoc(null) }}
                      style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                  : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.file_name}</span>
                }
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: (DOC_COLORS[d.type] ?? '#6B7280') + '18', color: DOC_COLORS[d.type] ?? '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.size ?? ''}</span>
                <div style={{ display: 'flex' }}>
                  <button onClick={() => { setRenamingDoc(i); setRenameValue(d.name ?? d.file_name ?? '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>
                  <button onClick={() => setPreviewDoc(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
                  <button onClick={() => setDocs(docs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>
                </div>
              </div>
            </div>
          )
        })
      }
      <input ref={fileRef} type="file" style={{ display: 'none' }} multiple
        onChange={e => {
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
