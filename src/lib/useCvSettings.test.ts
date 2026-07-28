/**
 * useCvSettings — migration-safety tests for the CV section placement feature
 * (Danny 28-07: "ik wil ook de locatie van elke sectie kunnen bepalen"). Covers
 * the pure resolution/normalization logic directly (no hook rendering, no API
 * mocking needed) since that is the exact seam responsible for a legacy blob
 * (saved before per-section placement existed) rendering unchanged.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveCvSectionPlacement, normalizeCvSections, CV_DEFAULT_SECTIONS,
  CV_FIXED_PLACEMENT, CV_MOVABLE_SECTION_IDS,
} from './useCvSettings'

describe('resolveCvSectionPlacement', () => {
  it('falls back to the current default layout when placement is missing (legacy blob)', () => {
    // A section saved before this feature existed — no `placement` key at all.
    expect(resolveCvSectionPlacement({ id: 'contact' })).toBe('sidebar')
    expect(resolveCvSectionPlacement({ id: 'languages' })).toBe('sidebar')
    expect(resolveCvSectionPlacement({ id: 'skills' })).toBe('sidebar')
    expect(resolveCvSectionPlacement({ id: 'certificates' })).toBe('sidebar')
    expect(resolveCvSectionPlacement({ id: 'preferences' })).toBe('main')
  })

  it('honours an explicit, valid stored placement for a movable section', () => {
    expect(resolveCvSectionPlacement({ id: 'contact', placement: 'main' })).toBe('main')
    expect(resolveCvSectionPlacement({ id: 'languages', placement: 'sidebar' })).toBe('sidebar')
  })

  it('clamps structurally-fixed sections regardless of a stored/malformed value', () => {
    // summary always sits in the header — it has no sidebar/main column of its own.
    expect(resolveCvSectionPlacement({ id: 'summary' })).toBe('header')
    expect(resolveCvSectionPlacement({ id: 'summary', placement: 'sidebar' })).toBe('header')
    // experience/education never fit the narrow sidebar, even if a stray value claims so.
    expect(resolveCvSectionPlacement({ id: 'experience', placement: 'sidebar' })).toBe('main')
    expect(resolveCvSectionPlacement({ id: 'education', placement: 'sidebar' })).toBe('main')
  })

  it('falls back to "main" for an unknown id with no stored placement', () => {
    expect(resolveCvSectionPlacement({ id: 'some-future-section' })).toBe('main')
  })
})

describe('normalizeCvSections', () => {
  it("backfills every default section's placement to today's layout, unchanged", () => {
    const legacy = CV_DEFAULT_SECTIONS.map(({ id, label, enabled }) => ({ id, label, enabled })) // no `placement`
    const normalized = normalizeCvSections(legacy)
    expect(normalized.map(s => ({ id: s.id, placement: s.placement }))).toEqual(
      CV_DEFAULT_SECTIONS.map(s => ({ id: s.id, placement: s.placement })),
    )
  })

  it('keeps a legacy stored label as data (for the settings screen defaultValue fallback) without using it for placement', () => {
    const legacy = [{ id: 'summary', label: 'About me', enabled: true }]
    const [normalized] = normalizeCvSections(legacy)
    expect(normalized.label).toBe('About me')
    expect(normalized.placement).toBe('header')
  })

  it('preserves a tenant-chosen placement for a movable section across a normalize pass', () => {
    const stored = [{ id: 'languages', label: 'Languages', enabled: true, placement: 'main' as const }]
    const [normalized] = normalizeCvSections(stored)
    expect(normalized.placement).toBe('main')
  })
})

describe('CV_FIXED_PLACEMENT / CV_MOVABLE_SECTION_IDS', () => {
  it('every default section id is either fixed or movable, never neither/both', () => {
    for (const s of CV_DEFAULT_SECTIONS) {
      const isFixed = Boolean(CV_FIXED_PLACEMENT[s.id])
      const isMovable = CV_MOVABLE_SECTION_IDS.includes(s.id)
      expect(isFixed).toBe(!isMovable)
    }
  })

  it('exposes exactly the expected movable ids', () => {
    expect(CV_MOVABLE_SECTION_IDS.sort()).toEqual(
      ['contact', 'languages', 'skills', 'certificates', 'preferences'].sort(),
    )
  })
})
