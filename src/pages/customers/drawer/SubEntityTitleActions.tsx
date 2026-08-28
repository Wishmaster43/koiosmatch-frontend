/**
 * SubEntityTitleActions — the shared title-row action cluster for a customer
 * sub-entity detail (location/department/contact): pager, changelog icon-popover,
 * merge, archive, delete. Extracted out of LocationDetail (§0.3 split — that file
 * passed ~450 lines once ARCHIVE-SUBENTITY-1/LOCATIE-SAMENVOEGEN-1 landed) so the
 * near-identical five-button cluster is not typed out three times across
 * Location/Department/ContactDetail — one shared, dumb/presentational component
 * (§3A: entity details stay thin containers, logic stays in the caller).
 * Each action is OPTIONAL and simply omitted when the caller has nothing to wire
 * (e.g. ContactDetail has no merge slot here — it renders its own pre-existing
 * merge icon, a different feature that predates this extraction).
 */
import { Trash2, Archive, GitMerge } from 'lucide-react'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './ChangelogTab'
import DrillPager, { type DrillPagerProps } from '@/components/drawer/DrillPager'
import Button from '@/components/ui/Button'

export interface SubEntityTitleActionsProps {
  /** Prev/next through the caller's own filtered rows (DRILL-PAGER-1). */
  pager?: DrillPagerProps
  /** LOC-DEPT-CHANGELOG-1: absent = no icon (e.g. no customerId to build the route yet). */
  changelogEndpoint?: string
  /** LOCATIE-SAMENVOEGEN-1/AFDELING-SAMENVOEGEN-1: absent = no icon (no permission or no candidate to merge with). */
  onMerge?: () => void
  /** Required WITH onMerge — the icon's name; rendering is gated on both so the §6 name guard stays real. */
  mergeTitle?: string
  /** ARCHIVE-SUBENTITY-1: absent = no icon (no permission, or already archived). */
  onArchive?: () => void
  /** Required WITH onArchive — same §6 gating as mergeTitle. */
  archiveTitle?: string
  archiving?: boolean
  onDelete: () => void
  deleteDisabled?: boolean
  deleteTitle: string
}

// The shared sub-entity title-row action cluster
// each action renders only when the caller wires a handler for it.
export default function SubEntityTitleActions({
  pager, changelogEndpoint, onMerge, mergeTitle, onArchive, archiveTitle, archiving = false,
  onDelete, deleteDisabled = false, deleteTitle,
}: SubEntityTitleActionsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {pager && <DrillPager {...pager} />}
      {changelogEndpoint && (
        <ChangelogPopover><ChangelogTab endpoint={changelogEndpoint} /></ChangelogPopover>
      )}
      {onMerge && mergeTitle && (
        <Button variant="secondary" iconOnly size="sm" onClick={onMerge} title={mergeTitle} aria-label={mergeTitle}>
          <GitMerge size={13} />
        </Button>
      )}
      {onArchive && archiveTitle && (
        <Button variant="secondary" iconOnly size="sm" onClick={onArchive} disabled={archiving}
          title={archiveTitle} aria-label={archiveTitle}
          style={{ color: 'var(--color-archive)' }}>
          <Archive size={13} />
        </Button>
      )}
      <Button variant="dangerSoft" iconOnly size="sm" onClick={onDelete} disabled={deleteDisabled} title={deleteTitle} aria-label={deleteTitle}>
        <Trash2 size={13} />
      </Button>
    </div>
  )
}
