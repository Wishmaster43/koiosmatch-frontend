/**
 * useOutreachFilters — client-side filter state + the filtered row set for
 * the outreach (call-lists) page: status/channel/owner/target-group/targets
 * dimensions plus the free-text search, applied over the active OR the
 * archived/trash base list. Extracted from OutreachPage.tsx (§0.3 size split)
 * — mirrors useApplicationFilters' state+predicate shape, adapted for this
 * page's fully client-side (not server-paginated) filtering.
 *
 * showArchived/showTrash stay OWNED BY THE PAGE (a sibling fetch hook and the
 * toolbar/drawer also need them), so this hook only RESETS its own
 * dimensions — the page composes the full clear-all with those two setters.
 */
import { useState, useMemo } from 'react'
import type { Campaign } from './useOutreachCampaigns'
import { statusKey, channelKey, targetsOf, ownerNameOf, targetGroupNameOf } from '../data/outreachCampaignFields'

interface UseOutreachFiltersArgs {
  campaigns: Campaign[]
  archived: Campaign[]
  lifecycleOf: (c?: Campaign) => string
  showArchived: boolean
  showTrash: boolean
}

// Owns the outreach page's filter dimensions and derives the filtered row set
// from either the active list or the archived/trash view (see file docblock).
export function useOutreachFilters({ campaigns, archived, lifecycleOf, showArchived, showTrash }: UseOutreachFiltersArgs) {
  // KPI/donut click-to-filter (status) + checkbox selection.
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  // Channel filter (second donut) + targets-only KPI toggle.
  const [selectedChannel, setSelectedChannel] = useState<string[]>([])
  const [kpiTargets, setKpiTargets] = useState(false)
  // Right-panel-only filters: owner + target group (source pool).
  const [selectedOwner, setSelectedOwner] = useState<string[]>([])
  const [selectedTargetGroup, setSelectedTargetGroup] = useState<string[]>([])
  const [query, setQuery] = useState('')  // shared header search (client-side, R-5)
  // Remount the (self-stateful) search input on clear so the visible text resets too.
  const [searchEpoch, setSearchEpoch] = useState(0)

  // Base rows per lifecycle view (TRASH-OVERAL-2, mirrors candidates): trash =
  // pending_erase only, archived = archived only, default = the active list.
  const baseRows = showTrash
    ? archived.filter((c) => lifecycleOf(c) === 'pending_erase')
    : showArchived
      ? archived.filter((c) => lifecycleOf(c) === 'archived')
      : campaigns
  // Status/channel/owner/target-group/targets narrow both the table and the board.
  const filtered = useMemo(() => {
    let byStatus = selectedStatus.length ? baseRows.filter((c) => selectedStatus.includes(statusKey(c))) : baseRows
    if (selectedChannel.length) byStatus = byStatus.filter((c) => selectedChannel.includes(channelKey(c)))
    if (selectedOwner.length) byStatus = byStatus.filter((c) => selectedOwner.includes(ownerNameOf(c)))
    if (selectedTargetGroup.length) byStatus = byStatus.filter((c) => selectedTargetGroup.includes(targetGroupNameOf(c)))
    if (kpiTargets) byStatus = byStatus.filter((c) => targetsOf(c) > 0)
    if (!query.trim()) return byStatus
    const q = query.trim().toLowerCase()
    return byStatus.filter((c) => `${(c as { name?: string }).name ?? ''}`.toLowerCase().includes(q))
  }, [baseRows, selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, kpiTargets, query])

  // OUTREACH-WISKNOP: same clear-all-filters parity as the other list pages —
  // includes the page-owned archived/trash flags so the shared button lights
  // up correctly even though this hook can't clear them itself.
  const anyFilterActive = Boolean(query.trim() || selectedStatus.length || selectedChannel.length
    || selectedOwner.length || selectedTargetGroup.length || kpiTargets || showArchived || showTrash)
  // Resets every filter dimension THIS hook owns, and bumps searchEpoch so the
  // (self-stateful) search input's visible text resets too. The page composes
  // this with resetting showArchived/showTrash for the full clear-all.
  const clearOwnFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setSelectedStatus([]); setSelectedChannel([])
    setSelectedOwner([]); setSelectedTargetGroup([]); setKpiTargets(false)
  }

  return {
    selectedStatus, setSelectedStatus, selectedChannel, setSelectedChannel,
    selectedOwner, setSelectedOwner, selectedTargetGroup, setSelectedTargetGroup,
    kpiTargets, setKpiTargets, query, setQuery, searchEpoch,
    filtered, anyFilterActive, clearOwnFilters,
  }
}
