/**
 * channelIcons · CHANNEL-ICON-1 — the merged channel's stable `icon`/`key` fields
 * (VacancyQuery::attachMergedChannels) now drive the icon, never a heuristic on
 * the tenant-editable display label (VacancyLookupSeeder's demo tenant renames
 * "Indeed" all the time — matching on that string was always one rename away
 * from a wrong/generic icon).
 */
import { describe, it, expect } from 'vitest'
import { Building2, Search, Briefcase, Globe } from 'lucide-react'
import { channelIcon } from './channelIcons'

describe('channelIcon', () => {
  it('maps the seed icon names exactly (VacancyLookupSeeder: globe/search/briefcase)', () => {
    expect(channelIcon('globe')).toBe(Globe)
    expect(channelIcon('search')).toBe(Search)
    expect(channelIcon('briefcase')).toBe(Briefcase)
  })

  it('is case/whitespace tolerant on the icon name', () => {
    expect(channelIcon(' Briefcase ')).toBe(Briefcase)
  })

  it('never matches on the editable label — a renamed channel keeps its icon', () => {
    // Same scenario as VacancyChannelKeyTest: renaming "Indeed" away from every
    // name heuristic keyword must not change which icon renders.
    expect(channelIcon('briefcase', 'indeed')).toBe(Briefcase)
  })

  it('falls back to the stable key when icon is missing/unrecognised', () => {
    expect(channelIcon(undefined, 'indeed')).toBe(Briefcase)
    expect(channelIcon(undefined, 'google_jobs')).toBe(Search)
    expect(channelIcon(undefined, 'career_site')).toBe(Globe)
    expect(channelIcon(undefined, 'werkzoeken')).toBe(Briefcase)
    // An unrecognised icon string falls through to the key.
    expect(channelIcon('not-a-real-icon', 'indeed')).toBe(Briefcase)
  })

  it('falls back to a generic globe for a totally unknown/legacy channel', () => {
    expect(channelIcon(undefined, undefined)).toBe(Globe)
    expect(channelIcon(null, null)).toBe(Globe)
    expect(channelIcon('mystery-icon', 'mystery-key')).toBe(Globe)
  })

  it('extends Building2/Users for a tenant-typed synonym icon name', () => {
    expect(channelIcon('building2')).toBe(Building2)
  })
})
