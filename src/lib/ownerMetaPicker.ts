/**
 * ownerMetaPicker — shared owner meta picker config for entity drawers.
 * Returns the partial picker config that can be spread into meta[] arrays.
 * The consumer passes entity ID, onUpdate callback, and ownerOptions.
 */
import type { Id } from '@/types/common'

interface OwnerMetaPickerOptions {
  entityId: Id | undefined
  value: Id | null | undefined
  options: Array<{ value: Id | null; label: string }>
  onUpdate?: (entityId: Id | undefined, updates: { ownerId: string | null }) => void
  label: string // i18n string, pre-translated by consumer
  clearLabel: string // i18n string, pre-translated by consumer
  placeholder?: string // optional, pre-translated by consumer
}

// Returns the owner meta picker config for entity drawers.
export function makeOwnerMetaPicker({
  entityId,
  value,
  options,
  onUpdate,
  label,
  clearLabel,
  placeholder,
}: OwnerMetaPickerOptions) {
  return {
    key: 'owner',
    label,
    value,
    options,
    ...(placeholder && { placeholder }),
    onChange: (val: string) => onUpdate?.(entityId, { ownerId: val || null }),
    menuWidth: 200,
    width: 190,
    clearable: true,
    clearLabel,
  }
}
