/**
 * Shared bulk-action node builders — reusable declarative config nodes for
 * ActionMenu trees across all bulk bars (candidates, customers, applications,
 * tasks, outreach, vacancies). Each builder returns a MenuNode fragment; the
 * caller spreads it into its items array, gating on permissions/counts as needed.
 */
import { Archive, GitMerge, Tag, Unlink } from 'lucide-react'
import type { MenuNode } from '@/components/ui/ActionMenu'
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
