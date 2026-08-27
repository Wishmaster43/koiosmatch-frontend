/**
 * importEntityIcon — UI-only icon per import template, shared by the sub-nav and the
 * content heading so one entity never wears two faces. A template the backend adds
 * later falls back to a generic file icon — the ENTITY LIST ITSELF always comes from
 * GET /imports/templates, never from this map.
 */
import { Building, Building2, FileSpreadsheet, MapPin, Network, Users, type LucideIcon } from 'lucide-react'
import { isWholeTreeTemplate } from './importTemplateShape'
import type { ImportTemplateSummary } from './importApi'

const ENTITY_ICONS: Record<string, LucideIcon> = {
  customers: Building2,
  locations: MapPin,
  departments: Building,
  contacts: Users,
}

/** The whole-tree file gets the hierarchy icon, decided on its columns (not its slug). */
export function iconForTemplate(template: ImportTemplateSummary): LucideIcon {
  if (isWholeTreeTemplate(template.columns)) return Network
  return ENTITY_ICONS[template.entity] ?? FileSpreadsheet
}
