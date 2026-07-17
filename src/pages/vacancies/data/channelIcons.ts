import { Building2, Search, Briefcase, Users, Globe } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'

/**
 * channelIcon — a per-channel icon for the drawer header's published indicator (V2,
 * VACATURES-100), matched heuristically by the channel's (tenant-editable) label.
 *
 * MEASURED: `vacancy_channels` HAS `icon`/`key` columns (create_vacancy_table.php),
 * but neither VacancyQuery::attachMergedChannels (channels_merged: value/label/
 * published only) nor VacancyLookupsContext.normalize() (value/label/color only)
 * expose them to the frontend today — so there is no tenant-driven icon/stable-key
 * to read here. This label-matching heuristic is a bounded, presentation-only
 * stand-in until backend-Claude wires `icon`/`key` through both; report as a
 * follow-up rather than hardcoding a slug→icon map keyed on an unstable uuid.
 */
export function channelIcon(label: string): ComponentType<{ size?: number; style?: CSSProperties }> {
  const l = label.toLowerCase()
  if (l.includes('indeed')) return Briefcase
  if (l.includes('google')) return Search
  if (l.includes('werkzoeken') || l.includes('werk.nl')) return Users
  if (l.includes('carri') || l.includes('career')) return Building2
  return Globe
}
