/**
 * Shared bulk-action node builders — reusable declarative config nodes for
 * ActionMenu trees across all bulk bars (candidates, customers, applications,
 * tasks, outreach, vacancies). Each builder returns a MenuNode fragment; the
 * caller spreads it into its items array, gating on permissions/counts as needed.
 */
import { Archive, GitMerge, Tag, UserCog, RefreshCw, Link2, Building2, Layers, StickyNote, Unlink } from 'lucide-react'
import type { MenuNode, MenuOption } from '@/components/ui/ActionMenu'
import type { Id } from '@/types/common'

// Archive action — same gating + danger styling across all bars.
export const archiveNode = (
  t: (key: string) => string,
  { canArchive, onArchive }: { canArchive?: boolean; onArchive: () => void },
): MenuNode[] => (
  canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []
)

// Merge action — two-row check (caller gates on count === 2; builder gates on canMerge + presence).
export const mergeNode = (
  t: (key: string) => string,
  { count, canMerge, onMerge }: { count: number; canMerge?: boolean; onMerge?: () => void },
): MenuNode[] => (
  count === 2 && canMerge && onMerge ? [{ key: 'merge', label: t('bulk.merge'), icon: GitMerge, onSelect: onMerge }] : []
)

// Remove-tag action — wraps tagOptions and the onPick callback.
export const removeTagNode = (
  t: (key: string) => string,
  { tagOptions, onRemoveTag }: { tagOptions: { value: string; label: string }[]; onRemoveTag: (tag: string) => void },
  { key = 'tag', labelKey = 'bulk.removeTag', iconType = Tag }: { key?: string; labelKey?: string; iconType?: typeof Tag } = {},
): MenuNode => ({
  key,
  label: t(labelKey),
  icon: iconType,
  searchPlaceholder: t('bulk.searchTag'),
  emptyText: t('bulk.noTags'),
  options: tagOptions,
  onPick: (v) => onRemoveTag(String(v)),
})

// Detach action — free-text input for a reason (ApplicationsBulkBar pattern).
export const detachNode = (
  t: (key: string) => string,
  { canManage, onDetach }: { canManage?: boolean; onDetach: (reason: string) => void },
): MenuNode[] => (
  canManage ? [{ key: 'detach', label: t('bulk.detach'), icon: Unlink, danger: true, input: true,
    placeholder: t('bulk.detachReasonPlaceholder'), submitLabel: t('bulk.detachConfirm'),
    onSubmit: (v: string | Array<string | number>) => onDetach(String(v)) }] : []
)

// Id picker wrapper — resolves a picked option id back to the full object the
// parent handler needs (users, customers, AI agents: anything keyed by `id`).
export const pickById = <T extends { id: Id }>(
  items: T[],
  handler: (item: T) => void,
) => (id: string | number) => {
  const item = items.find(x => x.id === id)
  if (item) handler(item)
}

// Pool picker wrapper — pools may lack an id, so the name doubles as the key.
export const pickPool = <T extends { id?: Id; name?: string; color?: string }>(
  items: T[],
  handler: (item: T) => void,
) => (id: string | number) => {
  const item = items.find(x => (x.id ?? x.name) === id)
  if (item) handler(item)
}

// Owner picker — the "change owner" menu node shared by candidates/customers/
// vacancies bars: resolves a picked user id back to the full user object.
export const ownerNode = <T extends { id: Id; name: string }>(
  t: (key: string) => string,
  { users, onSetOwner, userOptions }: { users: T[]; onSetOwner: (user: T) => void; userOptions: MenuOption[] },
): MenuNode => ({
  key: 'owner',
  label: t('bulk.changeOwner'),
  icon: UserCog,
  searchPlaceholder: t('bulk.searchOwner'),
  emptyText: t('bulk.noUsers'),
  options: userOptions,
  onPick: pickById(users, onSetOwner),
})

// GEO-REGEOCODE-1: bulk "re-fetch PDOK" — queued + async (202), no per-row
// reconcile. Gated on <entity>.update, same as the per-record GeocodeButton.
// Reuses the ONE shared common:geocode.refresh label (no per-entity i18n key) —
// mirrors the per-record GeocodeButton's tooltip text.
export const geocodeNode = (
  t: (key: string) => string,
  { canGeocode, onGeocode }: { canGeocode?: boolean; onGeocode?: () => void },
): MenuNode[] => (
  canGeocode && onGeocode ? [{ key: 'geocode', label: t('common:geocode.refresh'), icon: RefreshCw, onSelect: onGeocode }] : []
)

// SYNC-BULK-1: bulk backoffice coupling (HelloFlex/Shiftmanager) — queued + async;
// authorization + module-availability are resolved by the CALLER (mirrors
// BackofficeLinksTab's own canLink/useApps checks, §3B) and passed in here. Drills
// into whichever systems are actually enabled for this tenant (never offer a
// switched-off system).
export const coupleBackofficeNode = (
  t: (key: string) => string,
  { canCouple, onCoupleBackoffice, showHelloflex, showShiftmanager }: {
    canCouple?: boolean
    onCoupleBackoffice?: (system: 'helloflex' | 'shiftmanager') => void
    showHelloflex?: boolean
    showShiftmanager?: boolean
  },
): MenuNode[] => (
  canCouple && onCoupleBackoffice && (showHelloflex || showShiftmanager) ? [{
    key: 'couple', label: t('bulk.couple'), icon: Link2, items: [
      ...(showHelloflex ? [{ key: 'helloflex', label: t('common:backofficeLinks.helloflex.name'), icon: Building2, onSelect: () => onCoupleBackoffice('helloflex') }] : []),
      ...(showShiftmanager ? [{ key: 'shiftmanager', label: t('common:backofficeLinks.shiftmanager.name'), icon: Layers, onSelect: () => onCoupleBackoffice('shiftmanager') }] : []),
    ],
  }] : []
)

// NOTITIE-RTE-VRAAG-1: the "add note" menu entry — opens the caller's own
// BulkNoteModal (its open/close state and onSubmit wiring stay in the bar).
export const noteNode = (
  t: (key: string) => string,
  onOpen: () => void,
): MenuNode => ({ key: 'note', label: t('bulk.addNote'), icon: StickyNote, onSelect: onOpen })

// The `{ selected, clear, actions }` labels object every BulkActionsBar's header
// row takes — same three i18n keys on every bulk bar (candidates/customers/
// vacancies/tasks/matches/applications/outreach). A caller that needs a different
// `selected` string (e.g. a "whole filtered set" scope label) overrides it after
// spreading this in.
export const bulkBarLabels = (
  t: (key: string, options?: Record<string, unknown>) => string,
  count: number,
): { selected: string; clear: string; actions: string } => ({
  selected: t('bulk.selected', { count }),
  clear: t('bulk.deselect'),
  actions: t('bulk.actions'),
})
