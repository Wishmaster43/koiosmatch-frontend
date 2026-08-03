/**
 * TEMPORARY re-export shim (Danny 03-08, TAKEN-TOOLBAR-1). StatusFilterSelect moved to
 * `src/components/drawer/StatusFilterSelect.tsx` — it is now shared by the cross-entity
 * `EntityTasksTab` too, and a `components/` file must never import an entity page's
 * internals (§2). Every importer of this module was updated to the new path EXCEPT
 * `LocationsTab.tsx`, which another lane is actively editing during this change; this
 * shim keeps that file working, byte-identical, without touching it. Once that lane
 * lands, repoint `LocationsTab.tsx` to the new path and delete this file.
 */
export { default, useStatusFilter, isActiveValue, STATUS_FILTER_ALL } from '@/components/drawer/StatusFilterSelect'
