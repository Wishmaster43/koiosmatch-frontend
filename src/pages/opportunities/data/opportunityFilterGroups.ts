/**
 * buildOpportunityFilterGroups — the right-panel filter config for the
 * opportunities page (stage/owner/client/branch/archived), split into the
 * lifecycle-vs-organisation category headers (§3A blueprint, mirrors
 * buildCandidateFilterGroups/buildTaskFilterGroups). Pure function (§0.3 size
 * split): state + options come in, group config goes out.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'

interface Opt { value: string; label: string; count?: number }
type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => void

interface BuildArgs {
  t: TFunction
  tog: Tog
  stage: string[]; setStage: Dispatch<SetStateAction<string[]>>
  owner: string[]; setOwner: Dispatch<SetStateAction<string[]>>
  client: string[]; setClient: Dispatch<SetStateAction<string[]>>
  selectedBranch: string[]; setSelectedBranch: Dispatch<SetStateAction<string[]>>
  showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
  optionsFrom: (key: 'stage' | 'owner' | 'client') => Opt[]
  branchOptions: Opt[]
}

export function buildOpportunityFilterGroups({
  t, tog, stage, setStage, owner, setOwner, client, setClient,
  selectedBranch, setSelectedBranch, showArchived, setShowArchived,
  optionsFrom, branchOptions,
}: BuildArgs) {
  const catLifecycle    = t('filters.categories.lifecycle')
  const catOrganisation = t('filters.categories.organisation')
  const catDisplay      = t('filters.categories.display')

  return [
    // ── Lifecycle: where the deal stands.
    { key: 'stage', type: 'search-select', category: catLifecycle, label: t('insights.stage'), selected: stage, options: optionsFrom('stage'), onToggle: tog(setStage) },
    // ── Organisatie: who owns it, at which client/branch.
    // Owner option values are owner IDs (optionsFrom('owner')); labels stay the
    // display name — `owner`/`setOwner` hold IDs too (mirrors the page's filter).
    { key: 'owner',  type: 'search-select', category: catOrganisation, label: t('insights.owner'), selected: owner,  options: optionsFrom('owner'),  onToggle: tog(setOwner) },
    { key: 'client', type: 'search-select', category: catOrganisation, label: t('cols.client'),    selected: client, options: optionsFrom('client'), onToggle: tog(setClient) },
    // VESTIGING-2: inherited from the customer; values limited to the user's own
    // branch scope — never a widening.
    { key: 'branch', type: 'search-select', category: catOrganisation, label: t('common:filters.branch'), selected: selectedBranch, options: branchOptions, onToggle: tog(setSelectedBranch) },
    // ── Weergave: archived (view-scoping, not deal data).
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('filters.archived'), selected: showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('filters.archived') }], onToggle: () => setShowArchived(v => !v) },
  ]
}
