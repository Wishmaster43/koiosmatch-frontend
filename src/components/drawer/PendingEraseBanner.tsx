import type { ReactNode, ComponentType } from 'react'
import { ArchiveRestore } from 'lucide-react'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import type { Id } from '@/types/common'

interface PendingEraseBannerProps {
  id: Id | undefined
  // Pre-translated status line ("In trash since … · erased around …") — dumb like
  // ArchivedBanner, so one component serves every entity's own i18n namespace.
  message: ReactNode
  // Absent (no permission for the unmark route) → the button doesn't render.
  onUnmark?: (id: Id | undefined) => void
  // Pre-translated tooltip/aria-label for the unmark ("back to archive") button.
  unmarkLabel: string
  // Disables the unmark button and dims it while the request is in flight
  // (TrashLifecycleSection's own async unmark POST; matches/outreach fire-and-forget so
  // they never pass this and get the original always-enabled behaviour).
  unmarkBusy?: boolean
  // 'icon' (default, matches the original matches/outreach look) renders an icon-only
  // button tinted in the banner's own danger colour. 'button' (TrashLifecycleSection's
  // richer look) renders a soft-tint pill with a VISIBLE label in its own colour —
  // reads as an action, not just an icon, which is why TrashLifecycleSection wins the merge.
  unmarkVariant?: 'icon' | 'button'
  // Icon for the unmark control; defaults per variant (ArchiveRestore for 'icon', Undo2-style
  // callers pass their own icon for 'button' since TrashLifecycleSection uses lucide's Undo2).
  unmarkIcon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>
  // Colour for the 'button' variant's pill (TrashLifecycleSection uses the archive token,
  // distinct from the banner's own danger colour, to read as "go back", not "more danger").
  unmarkColor?: string
}

// Compact soft-tint action button (§4 — never a solid fill, never bare coloured text),
// shared by the 'button' unmark variant. Tint via lib/tint (house pair); ink via
// chipInk — the raw colour on its own tint reads 2.4-3.0:1, AA fail (r3.5).
const actionBtn = (color: string) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px',
  fontSize: 11.5, fontWeight: 600, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  color: chipInk(color), background: tintBg(color),
  border: tintBorder(color),
} as const)

/**
 * PendingEraseBanner (TRASH-OVERAL-2, unified TRASH-FE-POLISH-1) — the ONE shared
 * in-drawer trash state for trash-enabled entities: the danger-tinted sibling of
 * ArchivedBanner. Shows the pending-erase line (since-when + projected erase moment)
 * plus the unmark action that puts the record back into the plain archive.
 * Restore-to-active stays the archived view's own ArchivedBanner/restore path.
 * Two unmark looks share this one shell (icon-only for matches/outreach, a visible-label
 * pill for TrashLifecycleSection) — see `unmarkVariant`.
 */
export default function PendingEraseBanner({
  id, message, onUnmark, unmarkLabel, unmarkBusy = false,
  unmarkVariant = 'icon', unmarkIcon, unmarkColor = 'var(--color-archive)',
}: PendingEraseBannerProps) {
  const Icon = unmarkIcon ?? ArchiveRestore
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: chipInk('var(--color-danger)'), background: tintBg('var(--color-danger)'),
      border: tintBorder('var(--color-danger)') }}>
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      {onUnmark && unmarkVariant === 'button' && (
        // Pre-existing bespoke §4 soft-tint pill (own busy-fade opacity), out of this
        // ink/tint task's scope; not converted to avoid a size/identity regression.
        <button type="button" onClick={() => onUnmark(id)} disabled={unmarkBusy}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
          style={{ ...actionBtn(unmarkColor), opacity: unmarkBusy ? 0.6 : 1 }}>
          <Icon size={12} aria-hidden="true" /> {unmarkLabel}
        </button>
      )}
      {onUnmark && unmarkVariant === 'icon' && (
        <button onClick={() => onUnmark(id)} disabled={unmarkBusy} title={unmarkLabel} aria-label={unmarkLabel}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- pre-existing bespoke icon-only control with its own busy-fade opacity, out of this ink/tint task's scope
          style={{ background: 'none', border: 'none', cursor: unmarkBusy ? 'default' : 'pointer', padding: 3, display: 'flex',
            color: 'var(--color-danger)', opacity: unmarkBusy ? 0.6 : 1 }}>
          <Icon size={14} />
        </button>
      )}
    </div>
  )
}
