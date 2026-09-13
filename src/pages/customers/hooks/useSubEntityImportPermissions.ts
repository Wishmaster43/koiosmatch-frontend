import { useSafePermission } from '@/hooks/useSafePermission'

// Shared import-affordance gate for a customer sub-entity create modal
// (AddDepartmentModal, AddLocationModal, …): the Excel-import card lives
// under the same `customers.*` permissions as the sub-entity itself, since
// importing IS creating (§4 IMPORT-lives-in-the-create-modal rule).
export function useSubEntityImportPermissions() {
  const hasPermission = useSafePermission()
  const canViewImportTemplate = hasPermission('customers.view')
  const canRunImport = hasPermission('customers.create')
  return { canViewImportTemplate, canRunImport }
}
