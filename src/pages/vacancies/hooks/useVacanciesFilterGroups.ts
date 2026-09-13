/**
 * useVacanciesFilterGroups — builds the right-panel filter-group option lists
 * (owner/client/category from the insights donuts, status from the tenant lookup)
 * and assembles the final filterGroups array via buildVacancyFilterGroups. Extracted
 * from VacanciesPage once the page crossed the ~400 line split trigger (§3) — pure
 * derivation, no JSX, no data fetching.
 */
import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import { buildVacancyFilterGroups } from '../data/vacancyFilterGroups'
import type { VacancyPublishedBucket } from './useVacancyFilterParams'

interface DonutDatum { key: string; name: string; value: number }
interface StatusLookup { value: string; label: string; color?: string }
interface OptionEntry { value: string; label: string; count?: number; color?: string }

export function useVacanciesFilterGroups(args: {
  t: TFunction
  ownerData: DonutDatum[]; clientData: DonutDatum[]; categoryData: DonutDatum[]; agentData: DonutDatum[]
  statuses: StatusLookup[]
  branchOptions: OptionEntry[]
  selectedOwner: string[]; setSelectedOwner: React.Dispatch<React.SetStateAction<string[]>>
  selectedClient: string[]; setSelectedClient: React.Dispatch<React.SetStateAction<string[]>>
  selectedCategory: string[]; setSelectedCategory: React.Dispatch<React.SetStateAction<string[]>>
  selectedBranch: string[]; setSelectedBranch: React.Dispatch<React.SetStateAction<string[]>>
  statusBucket: string; setStatusBucket: React.Dispatch<React.SetStateAction<string>>
  publishedBucket: VacancyPublishedBucket; setPublishedBucket: React.Dispatch<React.SetStateAction<VacancyPublishedBucket>>
  selectedAgentId: string | null; setSelectedAgentId: React.Dispatch<React.SetStateAction<string | null>>
  showWithoutAgent: boolean; setShowWithoutAgent: React.Dispatch<React.SetStateAction<boolean>>
  hasApplications: boolean; setHasApplications: React.Dispatch<React.SetStateAction<boolean>>
  showArchived: boolean; setShowArchived: React.Dispatch<React.SetStateAction<boolean>>
  geoFilter: { q: string; km: number; lat: number; lng: number; label: string } | null
  geoHint: string | null
  applyGeo: (q: string, km: number) => Promise<void>
  clearGeo: () => void
}) {
  const { t, ownerData, clientData, categoryData, agentData, statuses, branchOptions } = args
  // Option lists for the right-panel filters (derived from the insights donuts + status lookup).
  const ownerOptions    = useMemo(() => ownerData.map(d => ({ value: d.key, label: d.name, count: d.value })), [ownerData])
  const clientOptions   = useMemo(() => clientData.map(d => ({ value: d.key, label: d.name, count: d.value })), [clientData])
  const categoryOptions = useMemo(() => categoryData.map(d => ({ value: d.key, label: d.name, count: d.value })), [categoryData])
  const statusOptions   = useMemo(() => statuses.map(s => ({ value: s.value, label: s.label, color: s.color })), [statuses])
  const agentOptions    = useMemo(() => agentData.map(d => ({ value: d.key, label: d.name, count: d.value })), [agentData])

  const tog = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

  // ONE builder owns every group and the canonical contiguous category order
  // (general → organisation → display) — page-level prepending split the
  // categories and made the sidebar render duplicate headings (Opus-verify).
  const filterGroups = useMemo(() => [
    ...buildVacancyFilterGroups({
      org: {
        owner:    { selected: args.selectedOwner,    options: ownerOptions,    onToggle: tog(args.setSelectedOwner) },
        client:   { selected: args.selectedClient,   options: clientOptions,   onToggle: tog(args.setSelectedClient) },
        category: { selected: args.selectedCategory, options: categoryOptions, onToggle: tog(args.setSelectedCategory) },
        branch:   { selected: args.selectedBranch,   options: branchOptions,   onToggle: tog(args.setSelectedBranch) },
      },
      t,
      filters: {
        statusBucket: args.statusBucket, setStatusBucket: args.setStatusBucket,
        publishedBucket: args.publishedBucket, setPublishedBucket: args.setPublishedBucket,
        selectedAgentId: args.selectedAgentId, setSelectedAgentId: args.setSelectedAgentId,
        showWithoutAgent: args.showWithoutAgent, setShowWithoutAgent: args.setShowWithoutAgent,
        hasApplications: args.hasApplications, setHasApplications: args.setHasApplications,
        showArchived: args.showArchived, setShowArchived: args.setShowArchived,
        geoFilter: args.geoFilter, geoHint: args.geoHint, applyGeo: args.applyGeo, clearGeo: args.clearGeo,
      },
      options: { statusOptions, agentOptions },
    }),
  ], [t, args.selectedOwner, args.setSelectedOwner, args.selectedClient, args.setSelectedClient, args.selectedCategory, args.setSelectedCategory,
    args.selectedBranch, args.setSelectedBranch, ownerOptions, clientOptions, categoryOptions, branchOptions,
    args.statusBucket, args.setStatusBucket, args.publishedBucket, args.setPublishedBucket, args.selectedAgentId, args.setSelectedAgentId,
    args.showWithoutAgent, args.setShowWithoutAgent, args.hasApplications, args.setHasApplications, args.showArchived, args.setShowArchived,
    args.geoFilter, args.geoHint, args.applyGeo, args.clearGeo, statusOptions, agentOptions])

  return { filterGroups, ownerOptions, clientOptions, categoryOptions, statusOptions, agentOptions, tog }
}
