import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Eye } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import { Caption, GroupLabel } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { useCandidateCvDocument } from '../hooks/useCandidateCvDocument'
import type { Id } from '@/types/common'

// Disabled-look footprint for the non-interactive placeholder span when the
// record carries no file url — the real download/preview actions are Button.
const iconBtnDisabled = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, color: 'var(--text-muted)', flexShrink: 0 } as const

/**
 * CvBlock — S31 (refined 25-07, Danny: "ja/nee" told him nothing — he wants to
 * see WHICH cv and from WHEN). Shows the file name (truncated with a `title`
 * attribute carrying the full name) and, on a muted second line, the upload
 * date, with a download + preview icon pair — mirrors the candidate Documents
 * section's own download link + DocPreviewModal (view-only here: no rename/
 * upload/delete, which stay the candidate record's own concern). The newest CV
 * (server order, see the hook) is the one shown/acted on. Four UI states; the
 * "none" state reads as a calm empty state (italic, mirrors "not registered
 * yet" elsewhere in the app).
 */
export default function CvBlock({ candidateId }: { candidateId: Id | null | undefined }) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDateTime } = useDateFormat()
  const { cvDocuments, loading, error } = useCandidateCvDocument(candidateId)
  const [previewOpen, setPreviewOpen] = useState(false)

  // No candidate linked yet — nothing to show, and nothing to fetch (§8 data minimisation).
  if (candidateId == null) return null

  // Newest CV first (server order) — the one shown/acted on.
  const cv = cvDocuments[0] ?? null
  const fileUrl = cv?.download_url ?? cv?.url
  const uploadedAt = cv?.created_at ?? cv?.uploaded_at

  return (
    <div>
      {/* Canon (05-08): the shared GroupLabel atom, reused instead of a hand-rolled copy. */}
      <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 6 }}>
        {t('drawer.cv.title')}
      </GroupLabel>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.cv.loading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.cv.error')}</div>}
      {!loading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {cv ? (
            <>
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* Canon (05-08): 12px value, matching the ApplicationDetailsCard Field convention. */}
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={cv.name}>
                  {cv.name || t('drawer.cv.title')}
                </div>
                {uploadedAt && (
                  <Caption as="div">
                    {t('drawer.cv.uploadedOn', { date: formatDateTime(uploadedAt) })}
                  </Caption>
                )}
              </div>
              {/* Download — the same plain anchor + `download` attribute the candidate
                  Documents preview modal already uses (the one download pattern in
                  the app); disabled look when the record carries no file url. */}
              {fileUrl ? (
                <Button variant="ghost" iconOnly size="sm" href={fileUrl} download={cv.name} target="_blank" rel="noopener noreferrer"
                  title={t('drawer.cv.download')} aria-label={t('drawer.cv.download')}>
                  <Download size={14} />
                </Button>
              ) : (
                <span aria-hidden="true" style={{ ...iconBtnDisabled, opacity: 0.4 }}><Download size={14} /></span>
              )}
              <Button variant="ghost" iconOnly size="sm" onClick={() => setPreviewOpen(true)} title={t('drawer.cv.view')} aria-label={t('drawer.cv.view')}>
                <Eye size={14} />
              </Button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('drawer.cv.none')}</span>
          )}
        </div>
      )}
      {previewOpen && cv && <DocPreviewModal doc={cv} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}
