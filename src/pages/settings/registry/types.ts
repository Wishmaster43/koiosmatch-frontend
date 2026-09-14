// Settings registry — shared NavItem/NavGroup types used by every registry/groups.*
// module and re-exported from registry.tsx (the public surface never changed by the split).
import type { LucideIcon } from 'lucide-react'
import type { SettingItemData } from '../components/SettingItem'

// One sub-tab: exactly one of render/schema/component picks its strategy (SettingItem),
// plus the gating/audit flags the shell (SettingsPage) reads to show/hide and label it.
// `schema` widens SettingItemData's literal-typed field: the schema modules under
// ./schemas are still plain untyped .js, so TS infers `type: string` there rather
// than the field's literal union — a real Schema is verified at SchemaSection's own
// call site (SettingItem.tsx), not re-checked here.
export interface NavItem extends Omit<SettingItemData, 'schema'> {
  id: string
  schema?: unknown
  icon?: LucideIcon
  logName?: string | null
  superAdminOnly?: boolean
  requiresPage?: string
  requiresModuleOrApp?: { module?: string; app?: string }
  requiresPermission?: string
}
// One sidebar category, grouping its NavItems into sub-tabs.
export interface NavGroup {
  key: string
  icon?: LucideIcon
  items: NavItem[]
}
