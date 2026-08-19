import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import type { PendingFile, AttachmentStatus } from './usePostCreateAttachments'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

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
  if (status === 'done') return <Check size={14} style={{ color: 'var(--color-success)' }} aria-hidden="true" />
  if (status === 'error') return <X size={14} style={{ color: 'var(--color-danger)' }} aria-hidden="true" />
  if (status === 'uploading') return <span style={{ color: 'var(--text-muted)' }}><Spinner size={14} /></span>
  return null
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
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('modal.attachments.resultsTitle')}</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('modal.attachments.resultsHint')}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {files.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <StatusIcon status={f.status} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            {f.status === 'error' && (
              <>
                <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{f.error}</span>
                <button type="button" onClick={() => onRetryFile(f.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-text)', fontSize: 11, fontWeight: 600 }}>
                  {t('common:error.retry')}
                </button>
              </>
            )}
          </div>
        ))}
        {noteText.trim() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <StatusIcon status={noteStatus} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{t('modal.attachments.noteLabel')}</span>
            {noteStatus === 'error' && (
              <>
                <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{noteError}</span>
                <button type="button" onClick={onRetryNote}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-text)', fontSize: 11, fontWeight: 600 }}>
                  {t('common:error.retry')}
                </button>
              </>
            )}
          </div>
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
