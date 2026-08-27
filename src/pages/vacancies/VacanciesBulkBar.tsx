/**
 * VacanciesBulkBar — selection action bar shown above the table when ≥1 vacancy is
 * checked. A single drill-in ActionMenu holds every bulk mutation; the data each
 * action needs (users, statuses, customers, tags) comes in via props so this stays
 * a thin assembler. Mirrors CandidatesBulkBar — extend by adding a node.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, Search, UserCog, CircleDot, Building2, Globe, GlobeLock, Bot, BotOff, Tag, StickyNote, Archive } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import BulkBarShell from '@/components/ui/BulkBarShell'
import BulkNoteModal from '@/components/ui/BulkNoteModal'
import type { Id, LookupOption } from '@/types/common'

interface BulkUser { id: Id; name: string }
interface BulkCustomer { id: Id; name: string }
interface BulkAiAgent { id: Id; name: string }
interface BulkVacancy { id: Id; title: string }

interface VacanciesBulkBarProps {
  count: number
  onClear: () => void
  onSetOwner: (u: BulkUser) => void
  onSetStatus: (v: string | number) => void
  onSetClient: (c: BulkCustomer) => void
  onPublish: () => void
  onUnpublish: () => void
  // VAC-BULK-AGENT-1: `null` = decouple the agent from the batch (a real mutation).
  onSetAiAgent: (agent: BulkAiAgent | null) => void
  onRemoveTag: (tag: string) => void
  onAddNote: (text: string) => void
  onArchive: () => void
  canArchive?: boolean
  users?: BulkUser[]
  statuses?: LookupOption[]
  customers?: BulkCustomer[]
  aiAgents?: BulkAiAgent[]
  selectedTags?: string[]
  // VAC-BULK-SEARCH-1 (Danny 14-08): the currently checked vacancies (id + title) —
  // one selected opens its "Kandidaten zoeken" tab directly, several show a picker.
  // Navigation only, no mutation, so it never touches optimistic bulk state.
  selectedVacancies?: BulkVacancy[]
  onOpenCandidateSearch?: (id: Id) => void
}

// See the file's top doc above; a thin assembler, all mutation data arrives via props.
export default function VacanciesBulkBar({
  count, onClear, onSetOwner, onSetStatus, onSetClient, onPublish, onUnpublish, onSetAiAgent,
  onRemoveTag, onAddNote, onArchive, canArchive = false,
  users = [], statuses = [], customers = [], aiAgents = [], selectedTags = [],
  selectedVacancies = [], onOpenCandidateSearch,
}: VacanciesBulkBarProps) {
  const { t } = useTranslation('vacancies')
  // NOTITIE-RTE-VRAAG-1: bulk note opens the shared rich-text modal.
  const [noteModalOpen, setNoteModalOpen] = useState(false)

  // Build the option lists from props.
  const userOptions = users.map(u => ({ value: u.id, label: u.name }))
  const statusOptions = statuses.map(s => ({ value: s.value, label: s.label, color: s.color }))
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }))
  const agentOptions = aiAgents.map(a => ({ value: a.id, label: a.name }))
  const tagOptions = selectedTags.map(tg => ({ value: tg, label: tg }))
  const vacancyOptions = selectedVacancies.map(v => ({ value: v.id, label: v.title }))

  // Resolve a picked user/customer/agent id back to the full object the parent needs.
  const pickUser = (handler: (u: BulkUser) => void) => (id: string | number) => { const u = users.find(x => x.id === id); if (u) handler(u) }
  const pickCustomer = (handler: (c: BulkCustomer) => void) => (id: string | number) => { const c = customers.find(x => x.id === id); if (c) handler(c) }
  const pickAgent = (id: string | number) => { const a = aiAgents.find(x => x.id === id); if (a) onSetAiAgent(a) }

  // Declarative bulk-action tree; archive is gated (server re-checks). "Kandidaten
  // zoeken" is navigation, not a mutation, so it goes first: one checked vacancy
  // opens its search tab directly, several show a drill-in picker (mirrors the
  // owner/status/client option-list nodes below).
  const items: MenuNode[] = [
    ...(onOpenCandidateSearch ? [
      selectedVacancies.length === 1
        ? { key: 'candidateSearch', label: t('bulk.searchCandidates'), icon: Search,
            onSelect: () => onOpenCandidateSearch(selectedVacancies[0].id) }
        : { key: 'candidateSearch', label: t('bulk.searchCandidates'), icon: Search,
            searchPlaceholder: t('bulk.searchVacancy'), emptyText: t('bulk.noVacancies'),
            options: vacancyOptions, onPick: onOpenCandidateSearch },
    ] as MenuNode[] : []),
    { key: 'owner', label: t('bulk.changeOwner'), icon: UserCog,
      searchPlaceholder: t('bulk.searchOwner'), emptyText: t('bulk.noUsers'), options: userOptions, onPick: pickUser(onSetOwner) },
    { key: 'status', label: t('bulk.changeStatus'), icon: CircleDot,
      searchPlaceholder: t('bulk.searchStatus'), options: statusOptions, onPick: onSetStatus },
    { key: 'client', label: t('bulk.changeClient'), icon: Building2,
      searchPlaceholder: t('bulk.searchClient'), emptyText: t('bulk.noClients'), options: customerOptions, onPick: pickCustomer(onSetClient) },
    { key: 'publishing', label: t('bulk.publishing'), icon: Globe, items: [
      { key: 'publish',   label: t('bulk.publish'),   icon: Globe,     onSelect: onPublish },
      { key: 'unpublish', label: t('bulk.unpublish'), icon: GlobeLock, onSelect: onUnpublish },
    ] },
    // VAC-BULK-AGENT-1: couple/decouple the AI-agent — same submenu shape as
    // publishing above. Decouple is a REAL mutation (ai_agent_id: null), so it is
    // offered next to the picker instead of leaving "remove" impossible in bulk.
    // Hidden while no agent is available to pick (module off / none configured /
    // list unavailable): an option list that can only ever be empty is a dead end.
    ...(agentOptions.length ? [{ key: 'aiAgent', label: t('bulk.aiAgent'), icon: Bot, items: [
      { key: 'aiAgentLink',   label: t('bulk.linkAgent'),   icon: Bot,
        searchPlaceholder: t('bulk.searchAgent'), emptyText: t('bulk.noAgents'), options: agentOptions, onPick: pickAgent },
      { key: 'aiAgentUnlink', label: t('bulk.unlinkAgent'), icon: BotOff, onSelect: () => onSetAiAgent(null) },
    ] }] : []),
    { key: 'tag', label: t('bulk.removeTag'), icon: Tag,
      searchPlaceholder: t('bulk.searchTag'), emptyText: t('bulk.noTags'), options: tagOptions, onPick: v => onRemoveTag(String(v)) },
    { key: 'note', label: t('bulk.addNote'), icon: StickyNote, onSelect: () => setNoteModalOpen(true) },
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []),
  ]

  return (
    <BulkBarShell label={t('bulk.selected', { count })} onClear={onClear} clearLabel={t('bulk.deselect')}>
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />
      <BulkNoteModal open={noteModalOpen} onClose={() => setNoteModalOpen(false)}
        onSubmit={html => { onAddNote(html); setNoteModalOpen(false) }}
        title={t('bulk.addNote')} submitLabel={t('bulk.noteSubmit')} />
    </BulkBarShell>
  )
}
