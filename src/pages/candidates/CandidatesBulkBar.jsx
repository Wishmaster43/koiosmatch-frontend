import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, Folder, FolderPlus, FolderMinus, UserCog, Milestone, Briefcase, Tag, StickyNote, Archive, X } from 'lucide-react'
import api from '../../lib/api'
import ActionMenu from '../../components/ui/ActionMenu'

/**
 * CandidatesBulkBar — the selection action bar shown above the table when ≥1
 * candidate is checked. A single "Massa mutaties" menu (ActionMenu, drill-in)
 * holds every bulk mutation. Each action is one config node; the data it needs
 * (users, lookups, tags) comes in via props so this stays a thin assembler.
 */
export default function CandidatesBulkBar({
  count, onClear, onAddToPool, onRemoveFromPool, onSetOwner, onSetStage, onSetType,
  onRemoveTag, onAddNote, onArchive, canArchive = false,
  users = [], funnelTypes = [], candidateTypes = [], selectedTags = [],
}) {
  const { t } = useTranslation('candidates')
  const [pools, setPools] = useState([])

  // Load the talent pools once for the add/remove option lists.
  useEffect(() => {
    api.get('/pools').then(r => { const d = r.data; setPools(Array.isArray(d) ? d : (d?.data ?? [])) }).catch(() => {})
  }, [])

  // Build the menu option lists from props/state.
  const poolOptions = pools.map(p => ({ value: p.id ?? p.name, label: p.name, color: p.color || '#6B7280' }))
  const userOptions = users.map(u => ({ value: u.id, label: u.name }))
  const stageOptions = funnelTypes.map(f => ({ value: f.value, label: f.label, color: f.color }))
  const typeOptions = candidateTypes.map(ct => ({ value: ct.value, label: ct.label, color: ct.color }))
  const tagOptions = selectedTags.map(tg => ({ value: tg, label: tg }))

  // Resolve a picked pool/user id back to the full object the parent needs.
  const pickPool = (handler) => (poolId) => { const p = pools.find(x => (x.id ?? x.name) === poolId); if (p) handler(p) }
  const pickUser = (handler) => (userId) => { const u = users.find(x => x.id === userId); if (u) handler(u) }

  // Declarative bulk-action tree; extend with more actions as extra nodes.
  // Archive is gated: only present when the user may delete (server re-checks).
  const items = [
    { key: 'owner', label: t('bulk.changeOwner'), icon: UserCog,
      searchPlaceholder: t('bulk.searchOwner'), emptyText: t('bulk.noUsers'), options: userOptions, onPick: pickUser(onSetOwner) },
    { key: 'pool', label: t('bulk.pool'), icon: Folder, items: [
      { key: 'add-pool', label: t('bulk.addToPool'), icon: FolderPlus,
        searchPlaceholder: t('bulk.searchPool'), emptyText: t('bulk.noPools'), options: poolOptions, onPick: pickPool(onAddToPool) },
      { key: 'remove-pool', label: t('bulk.removeFromPool'), icon: FolderMinus,
        searchPlaceholder: t('bulk.searchPool'), emptyText: t('bulk.noPools'), options: poolOptions, onPick: pickPool(onRemoveFromPool) },
    ] },
    { key: 'stage', label: t('bulk.changeStage'), icon: Milestone,
      searchPlaceholder: t('bulk.searchStage'), options: stageOptions, onPick: onSetStage },
    { key: 'type', label: t('bulk.changeType'), icon: Briefcase,
      searchPlaceholder: t('bulk.searchType'), options: typeOptions, onPick: onSetType },
    { key: 'tag', label: t('bulk.removeTag'), icon: Tag,
      searchPlaceholder: t('bulk.searchTag'), emptyText: t('bulk.noTags'), options: tagOptions, onPick: onRemoveTag },
    { key: 'note', label: t('bulk.addNote'), icon: StickyNote, input: true,
      placeholder: t('bulk.notePlaceholder'), submitLabel: t('bulk.noteSubmit'), onSubmit: onAddNote },
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
        {t('bulk.selected', { count })}
      </span>

      {/* Single bulk-mutations menu with drill-in submenus */}
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', padding: '6px 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
