import { useTranslation } from 'react-i18next'
import { ArchiveRestore } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

interface VacancyArchivedBannerProps {
  id: Id | undefined
  // VAC-ARCHIVE-1: the soft-delete timestamp; null falls back to a flag-only line.
  archivedAt?: string | null
  // VAC-RESTORE-1 (BE 1ac4e14): POST /vacancies/{id}/restore — absent without permission.
  onRestore?: (id: Id | undefined) => void
}

/**
 * VacancyArchivedBanner — the in-body archived state (audit R1 item 8, §3A:
 * mirrors ApplicationArchivedBanner/candidates' ArchivedBanner). Shows
 * since-when + a restore action right under the header. The restore route
 * (VAC-RESTORE-1) landed the same day this banner first shipped without one —
 * the button renders only when the page passes onRestore (vacancies.update).
 */
export default function VacancyArchivedBanner({ id, archivedAt, onRestore }: VacancyArchivedBannerProps) {
  const { t } = useTranslation('vacancies')
  const { formatDate } = useDateFormat() as { formatDate: (d?: string | null) => string }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: 'var(--color-archive)', background: 'color-mix(in srgb, var(--color-archive) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-archive) 28%, transparent)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(archivedAt) }) : t('drawer.archivedBanner.flag')}
      </span>
      {onRestore && (
        <button onClick={() => onRestore(id)} title={t('drawer.archivedBanner.restore')} aria-label={t('drawer.archivedBanner.restore')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-archive)' }}>
          <ArchiveRestore size={14} />
        </button>
      )}
    </div>
  )
}
