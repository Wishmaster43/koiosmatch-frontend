/**
 * Settings registry — the single source of truth for the settings area.
 *
 * Each group is a sidebar category (icon + i18n `groups.<key>`); its items become
 * the sub-tabs shown for that category. An item renders in one of three ways,
 * checked in this order by the shell:
 *
 *   render: () => <X/>   — full control (used for parametrised sections)
 *   schema: <schema>     — declarative section via <SchemaSection> (the easy path)
 *   component: Component  — a custom section component
 *
 * Labels: groups.<key> and nav.<id> in the `settings` i18n namespace.
 * Gating: superAdminOnly | requiresPage | requiresPermission | (id === 'users') handled by the shell.
 *
 * logName (CHANGELOG-OVERAL-1) — optional backend audit-log table name for lookups
 * with audit trails. Rule: every item editing a tenant-managed lookup table whose
 * changes are audited (CoiosMatch-api/docs/reference/AUDIT-LOG-NAMES.md) sets
 * `logName: '<table>'` so the changelog popover queries the right log. Items editing
 * the settings key/value table (or that don't have audit trails yet) omit logName
 * (defaults to 'settings'). Set `logName: null` explicitly to disable the changelog
 * button for items whose section is multi-table (e.g., opportunity_lookups) or
 * tables not yet audited (with a comment explaining why).
 *
 * Add a setting = one item here. A simple toggle/number setting = add a `schema`
 * (or a line to an existing schema) and skip writing a component entirely.
 *
 * REGISTRY-SPLIT-1 (14-09): this file used to hold the full NAV_GROUPS array inline
 * (887 lines, over the 400-line house-style split point). It is now a thin
 * composition: each domain's groups live in their own module under ./registry/
 * (same NavItem/NavGroup shape, same item order), and this file only concatenates
 * them in their original display order and re-exports the public surface —
 * NAV_GROUPS, CATALOG_GROUP_HOSTS, NavItem, NavGroup — unchanged for every importer.
 */
import type { NavGroup } from './registry/types'
import { overviewGroups } from './registry/groups.overview'
import { candidateGroups } from './registry/groups.candidate'
import { customerGroups } from './registry/groups.customer'
import { vacancyGroups } from './registry/groups.vacancy'
import { fieldsGroups } from './registry/groups.fields'
import { systemGroups } from './registry/groups.system'
import { communicationGroups } from './registry/groups.communication'
import { adminGroups } from './registry/groups.admin'
import { CATALOG_GROUP_HOSTS as CATALOG_GROUP_HOSTS_DATA } from './registry/catalogHosts'

export type { NavItem, NavGroup } from './registry/types'
// Re-exported as a local object literal, not a bare re-export or an identifier
// alias: eslint's react-refresh/only-export-components only recognizes a literal
// expression as a "constant export" (allowConstantExport) — an identifier alias
// or a `export … from` re-export is "unknown" and flags every export in this
// file once mixed with NAV_GROUPS below.
export const CATALOG_GROUP_HOSTS = { ...CATALOG_GROUP_HOSTS_DATA }

// Full sidebar nav tree — the domain modules above concatenated in their original
// display order (kpis/company/ai/personalisation, candidate/applications,
// customers/contacts/opportunities, vacancies/tasks/matches/outreach,
// custom_fields/note_types/document_types/appointments,
// action_rules/workflows/planning/reports/views,
// communication/whatsapp/notifications,
// integrations/import_export/billing/superadmin/administration/audit).
export const NAV_GROUPS: NavGroup[] = [
  ...overviewGroups,
  ...candidateGroups,
  ...customerGroups,
  ...vacancyGroups,
  ...fieldsGroups,
  ...systemGroups,
  ...communicationGroups,
  ...adminGroups,
]
