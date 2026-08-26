/**
 * ChangelogTab — the bellijst's FIELD-CHANGE audit trail, rendered inside the shared
 * house ChangelogPopover (§3A(d)). Thin wrapper around the shared
 * `components/drawer/tabs/EntityChangelogTab` (§11 LANE-B): only the fetch and the
 * status/channel enum-label resolution are outreach-specific.
 */
import { useTranslation } from 'react-i18next'
import EntityChangelogTab from '@/components/drawer/tabs/EntityChangelogTab'
import { useOutreachActivity } from '../hooks/useOutreachActivity'
import type { Id } from '@/types/common'

// The call-list's field-change audit trail — status/channel resolve to their
// existing tenant-facing labels, everything else uses the shared generic rules.
export default function ChangelogTab({ campaignId }: { campaignId?: Id | null }) {
  const { t } = useTranslation('outreach')
  const { items, loading, error } = useOutreachActivity(campaignId)

  // status/channel enums resolve to their tenant labels; an empty value or any
  // other field defers to the shared generic formatting (dates/booleans/uuids).
  const formatValue = (field: string, val: unknown): string | undefined => {
    if (val === null || val === undefined || val === '') return undefined
    if (field === 'status')  return t(`status.${String(val)}`,  { defaultValue: String(val) })
    if (field === 'channel') return t(`channel.${String(val)}`, { defaultValue: String(val) })
    return undefined
  }

  return <EntityChangelogTab items={items} loading={loading} error={error} namespace="outreach" formatValue={formatValue} />
}
