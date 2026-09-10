/**
 * taskStatusMeta — the label/colour derivation for a task row's status field,
 * which arrives either as the tenant lookup object ({ label, color }) or as a
 * bare string on an older/lighter row shape. Shared by RelatedTasks and
 * SubtasksSection (both render a "sibling task" row with the same status chip).
 */
export interface TaskRowStatus { label?: string; color?: string }

export function taskStatusMeta(st: TaskRowStatus | string | null | undefined): { label: string | undefined; color: string } {
  const label = typeof st === 'object' ? st?.label : st
  const color = (typeof st === 'object' ? st?.color : null) ?? 'var(--text-muted)'
  return { label, color }
}
