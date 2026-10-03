/**
 * mappedValueLabel — the chip label for a mapping token already stored as a
 * filter value ("module · field"), resolved against the same numbered upstream
 * groups the "{ }" picker offers — so a token inserted earlier still reads with
 * its module/field name after a reload, instead of the bare `{{N.field}}`.
 */
import type { WorkflowVarGroup } from '@/types/workflow'
import { filterValueToken, parseFilterValueToken } from './filterValueToken'

// Null when `item` is not a mapping token, or no upstream group still carries
// that field any more (a deleted upstream module) — the caller falls back to
// the raw item text in that case. Parses through `parseFilterValueToken` so a
// stored `|format` suffix or a bare (no "N.") token still resolves, instead of
// only matching the exact `{{N.field}}` string a field happens to carry today.
export function mappedValueLabel(item: string, variables: WorkflowVarGroup[]): string | null {
  const parsed = parseFilterValueToken(item)
  if (!parsed) return null
  for (const g of variables) {
    const field = parsed.number != null
      ? g.fields.find(f => f.token === filterValueToken(parsed.number as number, parsed.field))
      : g.fields.find(f => f.label === parsed.field)
    if (field) return `${g.customName ?? g.moduleType} · ${field.sample ?? field.label}`
  }
  return null
}
