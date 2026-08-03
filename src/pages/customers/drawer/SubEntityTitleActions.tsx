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

// One shared icon-button look (28×28, bordered, tinted icon) for every action here.
const iconBtn = (color: string, disabled: boolean) => ({
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7,
  cursor: disabled ? 'not-allowed' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg)',
  color, opacity: disabled ? 0.6 : 1, flexShrink: 0,
} as const)

export interface SubEntityTitleActionsProps {
  /** Prev/next through the caller's own filtered rows (DRILL-PAGER-1). */
  pager?: DrillPagerProps
  /** LOC-DEPT-CHANGELOG-1: absent = no icon (e.g. no customerId to build the route yet). */
  changelogEndpoint?: string
  /** LOCATIE-SAMENVOEGEN-1/AFDELING-SAMENVOEGEN-1: absent = no icon (no permission or no candidate to merge with). */
  onMerge?: () => void
  mergeTitle?: string
  /** ARCHIVE-SUBENTITY-1: absent = no icon (no permission, or already archived). */
  onArchive?: () => void
  archiveTitle?: string
  archiving?: boolean
  onDelete: () => void
  deleteDisabled?: boolean
  deleteTitle: string
}

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
      {onMerge && (
        <button onClick={onMerge} title={mergeTitle} aria-label={mergeTitle} style={iconBtn('var(--text-muted)', false)}>
          <GitMerge size={13} />
        </button>
      )}
      {onArchive && (
        <button onClick={onArchive} disabled={archiving} title={archiveTitle} aria-label={archiveTitle}
          style={iconBtn('var(--color-archive)', archiving)}>
          <Archive size={13} />
        </button>
      )}
      <button onClick={onDelete} disabled={deleteDisabled} title={deleteTitle} aria-label={deleteTitle}
        style={iconBtn(deleteDisabled ? 'var(--text-muted)' : 'var(--color-danger)', deleteDisabled)}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}
