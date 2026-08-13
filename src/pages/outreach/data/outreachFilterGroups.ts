/**
 * buildOutreachFilterGroups — the right-panel filter config for the outreach
 * (call-lists) page: status/channel/owner/target-group(pool)/archived. Pure
 * function (§0.3 size split): state + options come in, group config goes out —
 * mirrors buildTaskFilterGroups/buildOpportunityFilterGroups. Options are
 * derived from the loaded campaigns, never a hardcoded vocabulary (the fixed
 * status/channel enums live in OutreachPage and are labelled here via i18n).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'

interface Opt { value: string; label: string; count?: number }
type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => void

interface BuildArgs {
  t: TFunction
  tog: Tog
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedChannel: string[]; setSelectedChannel: Dispatch<SetStateAction<string[]>>
  selectedOwner: string[]; setSelectedOwner: Dispatch<SetStateAction<string[]>>
  selectedTargetGroup: string[]; setSelectedTargetGroup: Dispatch<SetStateAction<string[]>>
  showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
  statusOptions: Opt[]; channelOptions: Opt[]; ownerOptions: Opt[]; targetGroupOptions: Opt[]
}

export function buildOutreachFilterGroups({
  t, tog, selectedStatus, setSelectedStatus, selectedChannel, setSelectedChannel,
  selectedOwner, setSelectedOwner, selectedTargetGroup, setSelectedTargetGroup,
  showArchived, setShowArchived,
  statusOptions, channelOptions, ownerOptions, targetGroupOptions,
}: BuildArgs) {
  const catCampaign     = t('filters.categories.campaign')
  const catOrganisation = t('filters.categories.organisation')
  const catDisplay      = t('filters.categories.display')

  return [
    // ── Campagne: state + delivery channel.
    { key: 'status',  type: 'search-select', category: catCampaign, label: t('insights.status'),  selected: selectedStatus,  options: statusOptions,  onToggle: tog(setSelectedStatus) },
    { key: 'channel', type: 'search-select', category: catCampaign, label: t('insights.channel'), selected: selectedChannel, options: channelOptions, onToggle: tog(setSelectedChannel) },
    // ── Organisatie: who owns it, which target group it was seeded from.
    ...(ownerOptions.length ? [{ key: 'owner', type: 'search-select', category: catOrganisation, label: t('filters.owner'), selected: selectedOwner, options: ownerOptions, onToggle: tog(setSelectedOwner) }] : []),
    ...(targetGroupOptions.length ? [{ key: 'targetGroup', type: 'search-select', category: catOrganisation, label: t('filters.targetGroup'), selected: selectedTargetGroup, options: targetGroupOptions, onToggle: tog(setSelectedTargetGroup) }] : []),
    // ── Weergave: archived (view-scoping, not campaign data).
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('filters.archived'), selected: showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('view.archived') }], onToggle: () => setShowArchived(v => !v) },
  ]
}
