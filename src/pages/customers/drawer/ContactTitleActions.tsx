/**
 * ContactTitleActions - the title-row action cluster of the contact drilldown
 * (pager, history popover, merge, archive, delete, erase). Extracted from
 * ContactDetail (§3 split trigger); purely presentational, markup unchanged.
 */
import { Trash2, GitMerge, Archive, UserX } from 'lucide-react'
import Button from '@/components/ui/Button'
import DrillPager, { type DrillPagerProps } from '@/components/drawer/DrillPager'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './ChangelogTab'
import type { Contact } from '@/types/customer'

interface ContactTitleActionsProps {
  contact: Contact
  existing: Contact[]
  pager?: DrillPagerProps
  canMerge: boolean
  canErase: boolean
  archiving: boolean
  t: (key: string, opts?: Record<string, unknown>) => string
  onMerge: () => void
  onArchive: () => void
  onDelete: () => void
  onErase: () => void
}

// Right-hand cluster of the title row; each button carries its own visibility gate.
export default function ContactTitleActions({ contact, existing, pager, canMerge, canErase, archiving, t, onMerge, onArchive, onDelete, onErase }: ContactTitleActionsProps) {
  return (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
    {/* Prev/next through the list this contact was opened from (DRILL-PAGER-1) —
        before the merge/delete actions, same corner as every other detail pager. */}
    {pager && <DrillPager {...pager} />}
    {/* LOC-DEPT-CHANGELOG-1: record history is an icon-popover in the title row,
        never a tab (§3A(d)) — reuses the shared customer ChangelogTab content
        with its own one-level-deeper endpoint. */}
    {contact.customerId != null && (
      <ChangelogPopover><ChangelogTab endpoint={`/customers/${contact.customerId}/contacts/${contact.id}/activity`} /></ChangelogPopover>
    )}
    {/* Merge — title-row action, exactly like the candidate drawer (§3A). Hidden
        without customers.update and when this customer has no second contact to
        merge with: a button that can only ever fail is a fake affordance. */}
    {canMerge && contact.customerId != null && existing.length > 1 && (
      <Button variant="secondary" iconOnly size="sm" onClick={onMerge} title={t('contacts.merge.title')} aria-label={t('contacts.merge.title')}>
        <GitMerge size={13} />
      </Button>
    )}
    {/* Archive: house secondary chrome; only the ICON colour is the archive token,
        which rides in as a style override. Button merges caller style last EXCEPT
        while disabled — the grey disabled recipe deliberately wins then (20-08),
        which is right here too: in-flight archiving should look inert. Gated on
        `canMerge` (Archive is update-class too, §5). */}
    {canMerge && !contact.archived && (
      <Button variant="secondary" iconOnly size="sm" onClick={onArchive} disabled={archiving}
        title={t('contacts.detail.archiveContact')} aria-label={t('contacts.detail.archiveContact')}
        style={{ color: 'var(--color-archive)' }}>
        <Archive size={13} />
      </Button>
    )}
    <Button variant="dangerSoft" iconOnly size="sm" onClick={onDelete} title={t('common:delete')} aria-label={t('common:delete')}>
      <Trash2 size={13} />
    </Button>
    {/* ONIX K-005: hidden without privacy.erase, hidden once already archived
        (erase leaves the contact archived, so a second click would always
        fail — fake affordance). */}
    {canErase && contact.customerId != null && !contact.archived && (
      <Button variant="dangerSoft" iconOnly size="sm" onClick={onErase}
        title={t('contacts.detail.erasePerson')} aria-label={t('contacts.detail.erasePerson')}>
        <UserX size={13} />
      </Button>
    )}
  </div>
  )
}
