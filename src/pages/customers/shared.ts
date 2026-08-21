/**
 * customers — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { mapCustomerNoteRow } from './data/mapCustomer'
export type { ApiCustomerNoteRow } from './data/mapCustomer'
export { useCustomerDepartments } from './hooks/useCustomerDepartments'
export { default as CustomerCompanyTextPopout } from './popout/CustomerCompanyTextPopout'
export { default as CustomerDepartmentTextPopout } from './popout/CustomerDepartmentTextPopout'
export { default as CustomerLocationTextPopout } from './popout/CustomerLocationTextPopout'
