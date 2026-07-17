import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'

interface VacancyArchivedBannerProps {
  // VAC-ARCHIVE-1: the soft-delete timestamp; null falls back to a flag-only line.
  archivedAt?: string | null
}

/**
 * VacancyArchivedBanner — the in-body archived state (audit R1 item 8, §3A:
 * mirrors ApplicationArchivedBanner/candidates' ArchivedBanner). The table
 * already shows the soft "Gearchiveerd" chip when include_archived=1, but the
 * drawer itself had no equivalent — this shows since-when right under the
 * header so the archived state reads honestly here too.
 *
 * No restore action: unlike applications (`POST /applications/{id}/restore`),
 * routes/api/tenant/vacancies.php exposes only `DELETE /vacancies/{id}` (soft-
 * delete) and `POST /vacancies/bulk/archive` — measured, no restore endpoint
 * exists for vacancies today. Rendering a restore button here would be a fake
 * affordance (§7: never promise an action the backend can't perform), so this
 * stays informational-only until a restore route ships.
 */
export default function VacancyArchivedBanner({ archivedAt }: VacancyArchivedBannerProps) {
  const { t } = useTranslation('vacancies')
  const { formatDate } = useDateFormat() as { formatDate: (d?: string | null) => string }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: 'var(--color-archive)', background: 'color-mix(in srgb, var(--color-archive) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-archive) 28%, transparent)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(archivedAt) }) : t('drawer.archivedBanner.flag')}
      </span>
    </div>
  )
}
