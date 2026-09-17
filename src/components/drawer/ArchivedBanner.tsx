/**
 * ArchivedBanner — the ONE shared in-body archived state for every entity drawer
 * (extracted from the near-identical VacancyArchivedBanner/ApplicationArchivedBanner,
 * ~40 lines each, that would otherwise have gained a 3rd/4th copy for matches/
 * opportunities, and later adopted by vacancies/applications too, retiring those
 * two local copies). Shows the since-when line + a restore action right under the
 * header, using the shared `--color-archive` token (§4 — the same one the list's
 * QuickViewToggle uses for this exact state).
 */
import type { ReactNode } from 'react'
import { ArchiveRestore } from 'lucide-react'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import DrawerGlyphButton from './DrawerGlyphButton'
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

// Dumb: strings arrive as props, so it never needs its own i18n namespace — each
// entity keeps its own translation keys and passes the already-translated
// message/restoreLabel in.
export default function ArchivedBanner({ id, message, onRestore, restoreLabel }: ArchivedBannerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: chipInk('var(--color-archive)'), background: tintBg('var(--color-archive)'),
      border: tintBorder('var(--color-archive)') }}>
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      {onRestore && (
        <DrawerGlyphButton onClick={() => onRestore(id)} title={restoreLabel} tone="archive">
          <ArchiveRestore size={14} />
        </DrawerGlyphButton>
      )}
    </div>
  )
}
