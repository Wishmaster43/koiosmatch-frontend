/**
 * CustomersBulkBar — selection action bar shown above the table when ≥1 customer
 * is checked. One "Bulk actions" menu (ActionMenu, drill-in) holds every bulk
 * mutation; data per action arrives via props so this stays a thin assembler.
 * Mirrors CandidatesBulkBar.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserCog, CircleDot, Tag, Tags, StickyNote, RefreshCw, Link2, Building2, Layers } from 'lucide-react'
import type { MenuNode } from '@/components/ui/ActionMenu'
import BulkActionsBar from '@/components/ui/BulkActionsBar'
import BulkNoteModal from '@/components/ui/BulkNoteModal'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import { archiveNode, pickById, removeTagNode } from '@/components/ui/bulk/bulkNodes'
import type { Id, LookupOption } from '@/types/common'

interface BulkUser { id: Id; name: string }

interface CustomersBulkBarProps {
  count: number
  onClear: () => void
  onSetOwner: (user: BulkUser) => void
  onSetStatus: (status: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onAddNote: (text: string) => void
  onArchive: () => void
  canArchive?: boolean
  // GEO-REGEOCODE-1: bulk "PDOK opnieuw ophalen" — queued + async (202), gated on
  // customers.update, same as the per-record GeocodeButton.
  onGeocode?: () => void
  canGeocode?: boolean
  // SYNC-BULK-1: bulk backoffice coupling (HelloFlex/Shiftmanager) — queued + async,
  // authorization + module-availability gated INSIDE this component (mirrors
  // BackofficeLinksTab's own canLink/useApps checks, §3B). Optional — the menu
  // entry only renders once the parent wires it (honest gate).
  onCoupleBackoffice?: (system: 'helloflex' | 'shiftmanager') => void
  users?: BulkUser[]
  statuses?: LookupOption[]
  selectedTags?: string[]
}

// The thin bulk-action assembler for the customers table.
export default function CustomersBulkBar({
  count, onClear, onSetOwner, onSetStatus, onAddTag, onRemoveTag, onAddNote, onArchive,
  canArchive = false, onGeocode, canGeocode = false, onCoupleBackoffice,
  users = [], statuses = [], selectedTags = [],
}: CustomersBulkBarProps) {
  const { t } = useTranslation('customers')
  // NOTITIE-RTE-VRAAG-1: the bulk note action opens the shared rich-text modal
  // instead of ActionMenu's bare input node.
  const [noteModalOpen, setNoteModalOpen] = useState(false)

  // SYNC-BULK-1: same permission as the per-record BackofficeLinksTab's `canLink`
  // (BackofficeEntityRegistry maps the "customer" entity to customers.update) —
  // never a new permission. Module availability mirrors that same tab's `useApps()`
  // gate so a disabled system (hf/shiftmanager app off for this tenant) is never offered.
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)
  const canCouple = hasPermission('customers.update')
  const showHelloflex = isAppEnabled('hf')
  const showShiftmanager = isAppEnabled('shiftmanager')

  // Option lists built from props.
  const userOptions   = users.map(u => ({ value: u.id, label: u.name }))
  const statusOptions = statuses.map(s => ({ value: s.value, label: s.label, color: s.color }))
  const tagOptions    = selectedTags.map(tg => ({ value: tg, label: tg }))

  // Resolve a picked user id back to the full object the parent needs.
  const pickUserHandler = pickById(users, onSetOwner)

  // Declarative bulk-action tree; archive is gated (server re-checks).
  const items: MenuNode[] = [
    { key: 'owner', label: t('bulk.changeOwner'), icon: UserCog,
      searchPlaceholder: t('bulk.searchOwner'), emptyText: t('bulk.noUsers'), options: userOptions, onPick: pickUserHandler },
    { key: 'status', label: t('bulk.changeStatus'), icon: CircleDot,
      searchPlaceholder: t('bulk.searchStatus'), options: statusOptions, onPick: v => onSetStatus(String(v)) },
    { key: 'add-tag', label: t('bulk.addTag'), icon: Tag, input: true,
      placeholder: t('bulk.tagPlaceholder'), submitLabel: t('bulk.tagSubmit'), onSubmit: v => onAddTag(String(v)) },
    removeTagNode(t, { tagOptions, onRemoveTag }, { key: 'remove-tag', labelKey: 'bulk.removeTag', iconType: Tags }),
    { key: 'note', label: t('bulk.addNote'), icon: StickyNote, onSelect: () => setNoteModalOpen(true) },
    // GEO-REGEOCODE-1: reuses the ONE shared common:geocode.refresh label (no
    // per-entity i18n key) — mirrors the per-record GeocodeButton's tooltip text.
    ...(canGeocode && onGeocode ? [{ key: 'geocode', label: t('common:geocode.refresh'), icon: RefreshCw, onSelect: onGeocode }] : []),
    // SYNC-BULK-1: bulk backoffice coupling — drills into whichever systems are
    // actually enabled for this tenant (never offer a switched-off system).
    ...(canCouple && onCoupleBackoffice && (showHelloflex || showShiftmanager) ? [{
      key: 'couple', label: t('bulk.couple'), icon: Link2, items: [
        ...(showHelloflex ? [{ key: 'helloflex', label: t('common:backofficeLinks.helloflex.name'), icon: Building2, onSelect: () => onCoupleBackoffice('helloflex') }] : []),
        ...(showShiftmanager ? [{ key: 'shiftmanager', label: t('common:backofficeLinks.shiftmanager.name'), icon: Layers, onSelect: () => onCoupleBackoffice('shiftmanager') }] : []),
      ],
    }] : []),
    ...archiveNode(t, { canArchive, onArchive }),
  ]

  return (
    <BulkActionsBar
      onClear={onClear}
      items={items}
      labels={{ selected: t('bulk.selected', { count }), clear: t('bulk.deselect'), actions: t('bulk.actions') }}
    >
      <BulkNoteModal open={noteModalOpen} onClose={() => setNoteModalOpen(false)}
        onSubmit={html => { onAddNote(html); setNoteModalOpen(false) }}
        title={t('bulk.addNote')} submitLabel={t('bulk.noteSubmit')} />
    </BulkActionsBar>
  )
}
