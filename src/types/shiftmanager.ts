/**
 * ShiftManager UI row types — the mapped (camelCase) shapes the SM pages build
 * from the `sm_*` API and pass to their tables/drawers. Permissive (index sig)
 * since they mirror loosely-typed external data.
 */

// A contact person row (ContactsPage → ContactDrawer).
export interface SmContactRow {
  id?: string | number
  firstname?: string
  lastname?: string
  function_title?: string
  planning?: boolean
  email?: string
  mobile?: string
  customer?: string
  location?: string
  [k: string]: unknown
}

// A department row (DepartmentsPage → DepartmentDrawer).
export interface SmDepartmentRow {
  id?: string | number
  name?: string
  status?: string
  customer?: string
  location?: string
  city?: string
  costCenter?: string
  employees?: number
  shifts?: number
  [k: string]: unknown
}

// A location row (LocationsPage → LocationDrawer).
export interface SmLocationRow {
  id?: string | number
  name?: string
  status?: string
  customer?: string
  address?: string
  city?: string
  departments?: number
  employees?: number
  [k: string]: unknown
}
