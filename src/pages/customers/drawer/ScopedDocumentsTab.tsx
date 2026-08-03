/**
 * ScopedDocumentsTab — the location/department drill-down's OWN Documenten
 * sub-tab (DOCS-LOC-DEPT-1). A thin wrapper around the shared DocumentsTab
 * (§11 — one documents surface family, never a fork): it overrides the GET
 * listing endpoint to the byLocation/byDepartment routes and LOCKS every
 * upload to this level (no `locations`/`departments` props → DocumentsTab
 * renders no "gekoppeld aan" picker at all — the level is already fixed by
 * which tab you are on, mirroring ScopedNotesTab's identical reasoning).
 *
 * The location scope rolls up its departments' documents too (?rollup=1,
 * mirrors CustomerLocationController::notes' own rollup) — a department is a
 * leaf, so its own listing never adds the param.
 */
import DocumentsTab from './DocumentsTab'
import type { Id } from '@/types/common'

export default function ScopedDocumentsTab({ scope, id, customerId }: {
  scope: 'location' | 'department'
  id: Id
  customerId?: Id
}) {
  const listUrl = customerId != null
    ? (scope === 'location'
      ? `/customers/${customerId}/locations/${id}/documents?rollup=1`
      : `/customers/${customerId}/departments/${id}/documents`)
    : undefined
  const lockedLevelFields: Record<string, string> = scope === 'location'
    ? { customer_location_id: String(id) }
    : { customer_department_id: String(id) }

  return <DocumentsTab customerId={customerId} listUrl={listUrl} lockedLevelFields={lockedLevelFields} />
}
