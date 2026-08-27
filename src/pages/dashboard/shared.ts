/**
 * dashboard — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { default as DashboardSwitcher } from './DashboardSwitcher'
export { BLOCK_LABEL_KEY, DASHBOARD_TEMPLATES, DASHBOARD_TYPES, KPI_LABEL_KEY, KPI_ROWS, canSwitchViews, switcherTypes, defaultHiddenBlocks } from './templates'
export type { DashboardType } from './templates'
// K3-REFIT: the ONE local-id ↔ server-key map (settings screen + viewmodel share it).
export { LOCAL_TO_SERVER, SERVER_TO_LOCAL, serverKeysToLocal, localIdsToServer } from './kpiKeyMap'
