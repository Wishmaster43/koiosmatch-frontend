import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Eye } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
import DocPreviewModal from '@/pages/candidates/drawer/DocPreviewModal'
import { useCandidateCvDocument } from '../hooks/useCandidateCvDocument'
import type { CvDocument } from '../hooks/useCandidateCvDocument'
import type { Id } from '@/types/common'

/**
 * CvBlock — S31: the linked candidate's CV(s) at a glance on the Sollicitatie
 * tab, so a recruiter doesn't have to jump to the Kandidaat tab to check the CV.
 * Reuses the candidate Documents tab's own preview/download affordance
 * (DocPreviewModal) rather than re-implementing a viewer — view-only here (no
 * rename/upload/delete, which stay the candidate record's own concern). Four UI
 * states; empty is a subtle italic line (never a blank gap).
 */
export default function CvBlock({ candidateId }: { candidateId: Id | null | undefined }) {
  const { t } = useTranslation('applications')
  const { formatDate } = useDateFormat()
  const { colorOf } = useDocumentTypes()
  const { cvDocuments, loading, error } = useCandidateCvDocument(candidateId)
  const [previewDoc, setPreviewDoc] = useState<CvDocument | null>(null)

  // No candidate linked yet — nothing to show, and nothing to fetch (§8 data minimisation).
  if (candidateId == null) return null

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
        {t('drawer.cv.title')}
      </div>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.cv.loading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.cv.error')}</div>}
      {!loading && !error && cvDocuments.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('drawer.cv.empty')}</div>
      )}
      {!loading && !error && cvDocuments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cvDocuments.map(d => (
            <div key={String(d.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: colorOf(d.type),
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={13} color="white" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.name}
                </div>
                {(d.uploaded_at ?? d.created_at) && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(d.uploaded_at ?? d.created_at)}</div>
                )}
              </div>
              <button onClick={() => setPreviewDoc(d)} title={t('drawer.cv.view')} aria-label={t('drawer.cv.view')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                <Eye size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}
