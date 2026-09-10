import type { Id } from '@/types/common'
import type { DepartmentPayload } from './useCustomerDepartments'

/**
 * DepartmentCallbacks — the department-mutation prop shape shared by LocationsTab
 * (which passes them straight through from CustomerDrawer) and LocationDetail
 * (which passes the same three on to DepartmentsPanel) — one exported type instead
 * of the identical three lines declared twice.
 */
export interface DepartmentCallbacks {
  onAddDepartment: (payload: DepartmentPayload, locationName?: string) => void
  onUpdateDepartment: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemoveDepartment: (id: Id) => void
}
