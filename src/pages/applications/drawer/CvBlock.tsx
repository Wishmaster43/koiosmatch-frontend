import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Eye } from 'lucide-react'
import DocPreviewModal from '@/pages/candidates/drawer/DocPreviewModal'
import { useCandidateCvDocument } from '../hooks/useCandidateCvDocument'
import type { Id } from '@/types/common'

// Icon-only action button (and the matching anchor variant for the download
// link) — one shared visual so download/preview read as a pair, mirroring the
// candidate Documents section's own row actions.
const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', background: 'none',
  border: 'none', textDecoration: 'none', flexShrink: 0 } as const

/**
 * CvBlock — S31 (refined 21-07, Danny): a compact Ja/Nee indicator of whether
 * the linked candidate has a CV document (type === 'CV'), with a download +
 * preview icon pair once Ja — mirrors the candidate Documents section's own
 * download link + DocPreviewModal (view-only here: no rename/upload/delete,
 * which stay the candidate record's own concern). The newest CV (server order,
 * see the hook) is the one shown/acted on. Four UI states; Nee reads as a calm
 * empty state (italic, mirrors "not registered yet" elsewhere in the app).
 */
export default function CvBlock({ candidateId }: { candidateId: Id | null | undefined }) {
  const { t } = useTranslation(['applications', 'common'])
  const { cvDocuments, loading, error } = useCandidateCvDocument(candidateId)
  const [previewOpen, setPreviewOpen] = useState(false)

  // No candidate linked yet — nothing to show, and nothing to fetch (§8 data minimisation).
  if (candidateId == null) return null

  // Newest CV first (server order) — the one Ja/download/preview act on.
  const cv = cvDocuments[0] ?? null
  const fileUrl = cv?.download_url ?? cv?.url

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
        {t('drawer.cv.title')}
      </div>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.cv.loading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.cv.error')}</div>}
      {!loading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {cv ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('common:yes')}</span>
              {/* Download — the same plain anchor + `download` attribute the candidate
                  Documents preview modal already uses (the one download pattern in
                  the app); disabled look when the record carries no file url. */}
              {fileUrl ? (
                <a href={fileUrl} download={cv.name} target="_blank" rel="noopener noreferrer"
                  title={t('drawer.cv.download')} aria-label={t('drawer.cv.download')} style={iconBtn}>
                  <Download size={14} />
                </a>
              ) : (
                <span aria-hidden="true" style={{ ...iconBtn, opacity: 0.4, cursor: 'default' }}><Download size={14} /></span>
              )}
              <button onClick={() => setPreviewOpen(true)} title={t('drawer.cv.view')} aria-label={t('drawer.cv.view')} style={iconBtn}>
                <Eye size={14} />
              </button>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('common:no')}</span>
          )}
        </div>
      )}
      {previewOpen && cv && <DocPreviewModal doc={cv} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}
