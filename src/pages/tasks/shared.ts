/**
 * tasks — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { default as AddTaskModal } from './AddTaskModal'
export { isTaskOverdue } from './data/mapTask'
export { default as TaskDescriptionPopout } from './popout/TaskDescriptionPopout'
// ASSIST-SIDEPANEEL-2: the note popup's action panel couples a task item to an
// entity through the SAME picker + vocabulary the task drawer/create use.
export { default as AddLinkRow } from './links/AddLinkRow'
export type { NewLink } from './links/AddLinkRow'
