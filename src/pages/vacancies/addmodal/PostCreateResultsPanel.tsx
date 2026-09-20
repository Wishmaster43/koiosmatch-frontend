import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import type { PendingFile, AttachmentStatus } from './usePostCreateAttachments'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
// HUISSTIJL-1: the panel title (13/600/text) is the shared SectionTitle atom.
import { SectionTitle } from '@/components/ui/typography'

interface Props {
  files: PendingFile[]
  noteText: string
  noteStatus: AttachmentStatus
  noteError: string
  running: boolean
  onRetryFile: (id: string) => void
  onRetryNote: () => void
  onClose: () => void
}

// One result row's status icon — shared shape for documents and the note.
function StatusIcon({ status }: { status: AttachmentStatus }) {
  if (status === 'done') return <Check size={14} style={{ color: 'var(--color-success-text)' }} aria-hidden="true" />
  if (status === 'error') return <X size={14} style={{ color: 'var(--color-danger-text)' }} aria-hidden="true" />
  if (status === 'uploading') return <span style={{ color: 'var(--text-muted)' }}><Spinner size={14} /></span>
  return null
}

// One result row — a boxed status/label/error/retry line, shared by every
// pending file AND the optional note (only the label's ellipsis truncation
// differs: a filename can be long, the fixed note label never is).
function ResultRow({ status, label, ellipsis, error, retryLabel, onRetry }: {
  status: AttachmentStatus
  label: string
  ellipsis?: boolean
  error?: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <StatusIcon status={status} />
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', ...(ellipsis ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}>{label}</span>
      {status === 'error' && (
        <>
          <span style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{error}</span>
          {/* HUISSTIJL-1: the retry action is a real Button, not a hand-painted text link. */}
          <Button variant="ghost" size="sm" onClick={onRetry}>{retryLabel}</Button>
        </>
      )}
    </div>
  )
}

/**
 * PostCreateResultsPanel — punten 21+22: shown INSTEAD of the form cards once
 * Create has succeeded and there was at least one pending file/note. The
 * vacancy already exists at this point (§3 partial-failure discipline) — every
 * item's outcome shows independently (created ✓ / failed ✗ with a reason),
 * failed ones stay retryable, and Close is always the recruiter's own choice.
 */
export default function PostCreateResultsPanel({ files, noteText, noteStatus, noteError, running, onRetryFile, onRetryNote, onClose }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <SectionTitle as="div">{t('modal.attachments.resultsTitle')}</SectionTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('modal.attachments.resultsHint')}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {files.map(f => (
          <ResultRow key={f.id} status={f.status} label={f.name} ellipsis error={f.error}
            retryLabel={t('common:error.retry')} onRetry={() => onRetryFile(f.id)} />
        ))}
        {noteText.trim() && (
          <ResultRow status={noteStatus} label={t('modal.attachments.noteLabel')} error={noteError}
            retryLabel={t('common:error.retry')} onRetry={onRetryNote} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button variant="primary" onClick={onClose} disabled={running}>
          {t('common:close')}
        </Button>
      </div>
    </div>
  )
}
