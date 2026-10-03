/**
 * filterFieldGroupsToVarGroups — adapter from the Make-style numbered FIELD
 * picker's own walked chain (`FilterFieldGroup[]`, filterFieldCatalog.ts) to
 * the shared `WorkflowVarGroup[]` shape VariablePicker's popover already
 * renders (ADDENDUM 3). One picker panel is reused for both the FIELD picker
 * and the condition VALUE's mapping affordance — never a second panel. The
 * inserted token is `{{N.field}}` (filterValueToken) so a mapped value reads
 * with the same "N. module" numbering the field picker shows.
 */
import type { FilterFieldGroup } from './filterFieldCatalog'
import type { WorkflowVarGroup } from '@/types/workflow'
import { filterValueToken } from './filterValueToken'

export function filterFieldGroupsToVarGroups(
  groups: FilterFieldGroup[],
  moduleLabel: (type: string) => string,
): WorkflowVarGroup[] {
  return groups.map(g => ({
    nodeId: g.nodeId,
    moduleType: g.moduleType,
    customName: `${g.number}. ${moduleLabel(g.moduleType)}`,
    // Static catalogue fields are always known (no test-run needed) — hasRun
    // true keeps the "not run yet" badge off this picker's groups.
    hasRun: true,
    fields: g.fields.map(f => ({ token: filterValueToken(g.number, f.key), label: f.key, sample: f.label })),
  }))
}
