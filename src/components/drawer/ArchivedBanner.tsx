import type { ReactNode } from 'react'
import { ArchiveRestore } from 'lucide-react'
import type { Id } from '@/types/common'

interface ArchivedBannerProps {
  id: Id | undefined
  // Pre-translated status line ("Archived since 12-07-2026" / a flag-only fallback)
  // — kept dumb (no useTranslation here) so one component serves every entity's own
  // i18n namespace (§3A: components/drawer shells stay presentational, like EntityHeader).
  message: ReactNode
  // Absent (no permission for the underlying restore route) → the button doesn't render.
  onRestore?: (id: Id | undefined) => void
  // Pre-translated tooltip/aria-label for the restore button.
  restoreLabel: string
}

/**
 * ArchivedBanner — the ONE shared in-body archived state for every entity drawer
 * (extracted from the near-identical VacancyArchivedBanner/ApplicationArchivedBanner,
 * ~40 lines each, that would otherwise have gained a 3rd/4th copy for matches/
 * opportunities). Shows the since-when line + a restore action right under the
 * header, using the shared `--color-archive` token (§4 — the same one the list's
 * QuickViewToggle uses for this exact state). Dumb: strings arrive as props, so it
 * never needs its own i18n namespace. Vacancies/applications/candidates keep their
 * existing local banners for now — adopting this shared one there is a follow-up,
 * not done here (out of this task's file boundary).
 */
export default function ArchivedBanner({ id, message, onRestore, restoreLabel }: ArchivedBannerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: 'var(--color-archive)', background: 'color-mix(in srgb, var(--color-archive) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-archive) 28%, transparent)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      {onRestore && (
        <button onClick={() => onRestore(id)} title={restoreLabel} aria-label={restoreLabel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-archive)' }}>
          <ArchiveRestore size={14} />
        </button>
      )}
    </div>
  )
}
