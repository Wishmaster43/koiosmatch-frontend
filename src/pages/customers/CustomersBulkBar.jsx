import { useTranslation } from 'react-i18next'
import { ListChecks, UserCog, CircleDot, Tag, Tags, StickyNote, Archive, X } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'

/**
 * CustomersBulkBar — selection action bar shown above the table when ≥1 customer
 * is checked. One "Bulk actions" menu (ActionMenu, drill-in) holds every bulk
 * mutation; data per action arrives via props so this stays a thin assembler.
 * Mirrors CandidatesBulkBar.
 */
export default function CustomersBulkBar({
  count, onClear, onSetOwner, onSetStatus, onAddTag, onRemoveTag, onAddNote, onArchive,
  canArchive = false, users = [], statuses = [], selectedTags = [],
}) {
  const { t } = useTranslation('customers')

  // Option lists built from props.
  const userOptions   = users.map(u => ({ value: u.id, label: u.name }))
  const statusOptions = statuses.map(s => ({ value: s.value, label: s.label, color: s.color }))
  const tagOptions    = selectedTags.map(tg => ({ value: tg, label: tg }))

  // Resolve a picked user id back to the full object the parent needs.
  const pickUser = (handler) => (userId) => { const u = users.find(x => x.id === userId); if (u) handler(u) }

  // Declarative bulk-action tree; archive is gated (server re-checks).
  const items = [
    { key: 'owner', label: t('bulk.changeOwner'), icon: UserCog,
      searchPlaceholder: t('bulk.searchOwner'), emptyText: t('bulk.noUsers'), options: userOptions, onPick: pickUser(onSetOwner) },
    { key: 'status', label: t('bulk.changeStatus'), icon: CircleDot,
      searchPlaceholder: t('bulk.searchStatus'), options: statusOptions, onPick: onSetStatus },
    { key: 'add-tag', label: t('bulk.addTag'), icon: Tag, input: true,
      placeholder: t('bulk.tagPlaceholder'), submitLabel: t('bulk.tagSubmit'), onSubmit: onAddTag },
    { key: 'remove-tag', label: t('bulk.removeTag'), icon: Tags,
      searchPlaceholder: t('bulk.searchTag'), emptyText: t('bulk.noTags'), options: tagOptions, onPick: onRemoveTag },
    { key: 'note', label: t('bulk.addNote'), icon: StickyNote, input: true,
      placeholder: t('bulk.notePlaceholder'), submitLabel: t('bulk.noteSubmit'), onSubmit: onAddNote },
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{t('bulk.selected', { count })}</span>

      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', padding: '6px 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
