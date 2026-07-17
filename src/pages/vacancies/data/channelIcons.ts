import { Building2, Search, Briefcase, Users, Globe } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'

type IconComponent = ComponentType<{ size?: number; style?: CSSProperties }>

/**
 * channelIcon — the exact icon for a merged job-board channel (drawer header's
 * published indicator), resolved from the backend's stable `icon`/`key` fields
 * (CHANNEL-ICON-1: VacancyQuery::attachMergedChannels now sends both), never a
 * heuristic on the tenant-editable display label.
 *
 * Primary lookup is `icon` — a free-text lucide icon name (VacancyChannelController
 * accepts any string up to 64 chars; VacancyLookupSeeder ships globe/search/
 * briefcase). Falls back to the stable `key` (career_site/google_jobs/indeed/
 * werkzoeken) for a row with no/unrecognised icon, e.g. a pre-CHANNEL-ICON-1 row
 * seeded before the column existed (see VacancyChannelKeyTest's null-key case).
 * A totally unknown channel gets a generic globe — never a blank/broken icon.
 */
const ICONS_BY_NAME: Record<string, IconComponent> = {
  globe: Globe,
  search: Search,
  briefcase: Briefcase,
  building: Building2,
  building2: Building2,
  users: Users,
}

// Fallback keyed on the seed's stable machine key (VacancyLookupSeeder).
const ICONS_BY_KEY: Record<string, IconComponent> = {
  career_site: Globe,
  google_jobs: Search,
  indeed: Briefcase,
  werkzoeken: Briefcase,
}

export function channelIcon(icon?: string | null, key?: string | number | null): IconComponent {
  const byIcon = icon ? ICONS_BY_NAME[String(icon).toLowerCase().trim()] : undefined
  if (byIcon) return byIcon
  const byKey = key != null ? ICONS_BY_KEY[String(key).toLowerCase().trim()] : undefined
  if (byKey) return byKey
  return Globe
}
