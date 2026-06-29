import { useTranslation } from 'react-i18next'
import { X, FileText } from 'lucide-react'
import { useDocumentTypes } from '@/lib/useDocumentTypes'

const isImage = (name = '') => /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
const isPdf   = (name = '') => /\.pdf$/i.test(name)

interface CandidateDoc {
  objectUrl?: string
  url?: string
  type?: string
  name?: string
  file_name?: string
}

export default function DocPreviewModal({ doc, onClose }: { doc?: CandidateDoc | null; onClose: () => void }) {
  const { t } = useTranslation('candidates')
  // Document type label + colour from the tenant lookup (seed fallback).
  const { labelOf: docTypeLabel, colorOf: docColor } = useDocumentTypes()
  if (!doc) return null
  const url = doc.objectUrl ?? doc.url
  const typeLabel = docTypeLabel(doc.type)
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', maxWidth: 800, width: '100%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: docColor(doc.type),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={13} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name ?? doc.file_name}</div>
            {doc.type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{typeLabel}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', minHeight: 400 }}>
          {!url ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('documents.noPreview')}
            </div>
          ) : isImage(doc.name) ? (
            <img src={url} alt={doc.name} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
          ) : isPdf(doc.name) ? (
            <iframe src={url} title={doc.name} style={{ width: '100%', height: 600, border: 'none' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 13 }}>
              {t('documents.previewUnavailable')} <a href={url} download={doc.name} style={{ marginLeft: 6, color: 'var(--color-primary)' }}>{t('documents.download')}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
