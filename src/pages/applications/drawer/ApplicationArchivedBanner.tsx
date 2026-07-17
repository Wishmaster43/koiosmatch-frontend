import { useTranslation } from 'react-i18next'
import { ArchiveRestore } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

interface ApplicationArchivedBannerProps {
  id: Id | undefined
  // APP-DELETED-AT-1: the real detach timestamp; null falls back to a flag-only line.
  deletedAt?: string | null
  onRestore?: (id: Id | undefined) => void
}

/**
 * ApplicationArchivedBanner — the in-body archived state (§3A: mirrors
 * candidates' ArchivedBanner, minus the hard-delete/trash stage no application
 * has). Shows since-when + a restore action right under the header, so the
 * archived state reads honestly instead of just hiding the footer's detach
 * button. Uses the shared `--color-archive` token — the same one the list's
 * QuickViewToggle already uses for this exact state (§4: one colour, one meaning).
 */
export default function ApplicationArchivedBanner({ id, deletedAt, onRestore }: ApplicationArchivedBannerProps) {
  const { t } = useTranslation('applications')
  const { formatDate } = useDateFormat() as { formatDate: (d?: string | null) => string }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: 'var(--color-archive)', background: 'color-mix(in srgb, var(--color-archive) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-archive) 28%, transparent)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {deletedAt ? t('archived.since', { date: formatDate(deletedAt) }) : t('archived.flag')}
      </span>
      {onRestore && (
        <button onClick={() => onRestore(id)} title={t('restore.button')} aria-label={t('restore.button')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-archive)' }}>
          <ArchiveRestore size={14} />
        </button>
      )}
    </div>
  )
}
