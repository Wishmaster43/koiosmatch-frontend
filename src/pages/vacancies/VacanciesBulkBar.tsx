import { useTranslation } from 'react-i18next'
import { ListChecks, UserCog, CircleDot, Building2, Globe, GlobeLock, Bot, BotOff, Tag, StickyNote, Archive, X } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { BTN_H } from '@/config/buttonMetrics'
import type { Id, LookupOption } from '@/types/common'

interface BulkUser { id: Id; name: string }
interface BulkCustomer { id: Id; name: string }
interface BulkAiAgent { id: Id; name: string }

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
}

/**
 * VacanciesBulkBar — selection action bar shown above the table when ≥1 vacancy is
 * checked. A single drill-in ActionMenu holds every bulk mutation; the data each
 * action needs (users, statuses, customers, tags) comes in via props so this stays
 * a thin assembler. Mirrors CandidatesBulkBar — extend by adding a node.
 */
export default function VacanciesBulkBar({
  count, onClear, onSetOwner, onSetStatus, onSetClient, onPublish, onUnpublish, onSetAiAgent,
  onRemoveTag, onAddNote, onArchive, canArchive = false,
  users = [], statuses = [], customers = [], aiAgents = [], selectedTags = [],
}: VacanciesBulkBarProps) {
  const { t } = useTranslation('vacancies')

  // Build the option lists from props.
  const userOptions = users.map(u => ({ value: u.id, label: u.name }))
  const statusOptions = statuses.map(s => ({ value: s.value, label: s.label, color: s.color }))
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }))
  const agentOptions = aiAgents.map(a => ({ value: a.id, label: a.name }))
  const tagOptions = selectedTags.map(tg => ({ value: tg, label: tg }))

  // Resolve a picked user/customer/agent id back to the full object the parent needs.
  const pickUser = (handler: (u: BulkUser) => void) => (id: string | number) => { const u = users.find(x => x.id === id); if (u) handler(u) }
  const pickCustomer = (handler: (c: BulkCustomer) => void) => (id: string | number) => { const c = customers.find(x => x.id === id); if (c) handler(c) }
  const pickAgent = (id: string | number) => { const a = aiAgents.find(x => x.id === id); if (a) onSetAiAgent(a) }

  // Declarative bulk-action tree; archive is gated (server re-checks).
  const items: MenuNode[] = [
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
    { key: 'note', label: t('bulk.addNote'), icon: StickyNote, input: true,
      placeholder: t('bulk.notePlaceholder'), submitLabel: t('bulk.noteSubmit'), onSubmit: v => onAddNote(String(v)) },
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{t('bulk.selected', { count })}</span>

      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', height: BTN_H, padding: '0 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
