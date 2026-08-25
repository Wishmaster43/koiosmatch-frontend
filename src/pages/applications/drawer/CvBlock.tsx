// CvBlock — the application drawer's view-only CV summary (file name, upload date,
// download + preview). See the fuller doc comment on the component below.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Eye } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { useCandidateCvDocument } from '../hooks/useCandidateCvDocument'
import type { Id } from '@/types/common'

// Disabled-look footprint for the non-interactive placeholder span when the
// record carries no file url — the real download/preview actions are Button.
const iconBtnDisabled = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, color: 'var(--text-muted)', flexShrink: 0 } as const

// One label-LEFT/value-RIGHT row (fieldRowCanon) — mirrors ApplicationDetailsCard's
// own Row byte-for-byte (Danny 22-08: "CV en tekst geen cv beschikbaar links en
// rechts uitlijnen!" — this block was the last label-above holdout on the tab).
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={{ ...CANON_LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 5 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}

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
    <Row label={t('drawer.cv.title')}>
      {loading && <span style={{ color: 'var(--text-muted)' }}>{t('drawer.cv.loading')}</span>}
      {!loading && error && <span style={{ color: 'var(--color-danger-text)' }}>{t('drawer.cv.error')}</span>}
      {!loading && !error && (
        cv ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('drawer.cv.none')}</span>
        )
      )}
      {previewOpen && cv && <DocPreviewModal doc={cv} onClose={() => setPreviewOpen(false)} />}
    </Row>
  )
}
