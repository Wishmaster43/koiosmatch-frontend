import { useTranslation } from 'react-i18next'
import { ListChecks, UserCog, CircleDot, Tag, Tags, StickyNote, Archive, RefreshCw, X, Link2, Building2, Layers } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { BTN_H } from '@/config/buttonMetrics'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
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

/**
 * CustomersBulkBar — selection action bar shown above the table when ≥1 customer
 * is checked. One "Bulk actions" menu (ActionMenu, drill-in) holds every bulk
 * mutation; data per action arrives via props so this stays a thin assembler.
 * Mirrors CandidatesBulkBar.
 */
export default function CustomersBulkBar({
  count, onClear, onSetOwner, onSetStatus, onAddTag, onRemoveTag, onAddNote, onArchive,
  canArchive = false, onGeocode, canGeocode = false, onCoupleBackoffice,
  users = [], statuses = [], selectedTags = [],
}: CustomersBulkBarProps) {
  const { t } = useTranslation('customers')

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
  const pickUser = (handler: (user: BulkUser) => void) => (userId: string | number) => { const u = users.find(x => x.id === userId); if (u) handler(u) }

  // Declarative bulk-action tree; archive is gated (server re-checks).
  const items: MenuNode[] = [
    { key: 'owner', label: t('bulk.changeOwner'), icon: UserCog,
      searchPlaceholder: t('bulk.searchOwner'), emptyText: t('bulk.noUsers'), options: userOptions, onPick: pickUser(onSetOwner) },
    { key: 'status', label: t('bulk.changeStatus'), icon: CircleDot,
      searchPlaceholder: t('bulk.searchStatus'), options: statusOptions, onPick: v => onSetStatus(String(v)) },
    { key: 'add-tag', label: t('bulk.addTag'), icon: Tag, input: true,
      placeholder: t('bulk.tagPlaceholder'), submitLabel: t('bulk.tagSubmit'), onSubmit: v => onAddTag(String(v)) },
    { key: 'remove-tag', label: t('bulk.removeTag'), icon: Tags,
      searchPlaceholder: t('bulk.searchTag'), emptyText: t('bulk.noTags'), options: tagOptions, onPick: v => onRemoveTag(String(v)) },
    { key: 'note', label: t('bulk.addNote'), icon: StickyNote, input: true,
      placeholder: t('bulk.notePlaceholder'), submitLabel: t('bulk.noteSubmit'), onSubmit: v => onAddNote(String(v)) },
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
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary-text)' }}>{t('bulk.selected', { count })}</span>

      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', height: BTN_H, padding: '0 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary-text)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
