/**
 * CandidateCvTemplate — tests for groupCvSections, the ONE function both the
 * generated PDF and the settings screen's live preview call to decide which
 * sections render in which CV region (§ CV section placement, Danny 28-07).
 * react-pdf's own primitives (Document/View/Text/…) are not real DOM nodes, so
 * they are not exercised through React Testing Library here — this suite
 * instead proves the shared, pure grouping logic that drives BOTH renderers,
 * which is exactly the seam the migration-safety and placement acceptance
 * criteria depend on.
 */
import { describe, it, expect } from 'vitest'
import { groupCvSections } from './CandidateCvTemplate'
import { resolveCvName, makeCvLabeller } from './cv/cvLabels'

describe('groupCvSections', () => {
  it("groups a legacy section list (no placement field) exactly like today's layout", () => {
    const legacy = [
      { id: 'contact', enabled: true },
      { id: 'summary', enabled: true },
      { id: 'experience', enabled: true },
      { id: 'education', enabled: true },
      { id: 'languages', enabled: true },
      { id: 'skills', enabled: true },
      { id: 'certificates', enabled: true },
      { id: 'preferences', enabled: false },
    ]
    const groups = groupCvSections(legacy)
    expect(groups.sidebar).toEqual(['contact', 'languages', 'skills', 'certificates'])
    expect(groups.main).toEqual(['experience', 'education'])
  })

  it('moves a movable section to the main column when its stored placement says so', () => {
    const sections = [
      { id: 'contact', enabled: true, placement: 'sidebar' },
      { id: 'summary', enabled: true, placement: 'header' },
      { id: 'experience', enabled: true, placement: 'main' },
      { id: 'education', enabled: true, placement: 'main' },
      { id: 'languages', enabled: true, placement: 'main' }, // relocated by the tenant
      { id: 'skills', enabled: true, placement: 'sidebar' },
      { id: 'certificates', enabled: true, placement: 'sidebar' },
      { id: 'preferences', enabled: false, placement: 'main' },
    ]
    const groups = groupCvSections(sections)
    expect(groups.sidebar).toEqual(['contact', 'skills', 'certificates'])
    expect(groups.main).toEqual(['experience', 'education', 'languages'])
  })

  it('excludes a disabled section from both regions', () => {
    const sections = [
      { id: 'contact', enabled: false, placement: 'sidebar' },
      { id: 'languages', enabled: true, placement: 'sidebar' },
    ]
    const groups = groupCvSections(sections)
    expect(groups.sidebar).toEqual(['languages'])
  })

  it('clamps experience/education to the main column even if a malformed value claims sidebar', () => {
    const sections = [
      { id: 'experience', enabled: true, placement: 'sidebar' },
      { id: 'education', enabled: true, placement: 'sidebar' },
      { id: 'contact', enabled: true, placement: 'sidebar' },
    ]
    const groups = groupCvSections(sections)
    expect(groups.main).toEqual(['experience', 'education'])
    expect(groups.sidebar).toEqual(['contact'])
  })

  it('never places summary in either region regardless of a stray stored value', () => {
    const sections = [
      { id: 'summary', enabled: true, placement: 'main' },
      { id: 'contact', enabled: true, placement: 'sidebar' },
    ]
    const groups = groupCvSections(sections)
    expect(groups.sidebar).not.toContain('summary')
    expect(groups.main).not.toContain('summary')
  })

  it('shows every default section when no configuration exists at all (very old caller)', () => {
    const groups = groupCvSections([])
    expect(groups.sidebar).toEqual(['contact', 'languages', 'skills', 'certificates'])
    expect(groups.main).toEqual(['experience', 'education', 'preferences'])
  })

  it('preserves stored order within each region', () => {
    const sections = [
      { id: 'certificates', enabled: true, placement: 'sidebar' },
      { id: 'contact', enabled: true, placement: 'sidebar' },
      { id: 'languages', enabled: true, placement: 'sidebar' },
    ]
    const groups = groupCvSections(sections)
    expect(groups.sidebar).toEqual(['certificates', 'contact', 'languages'])
  })
})

// BUG FIX: the CV header name used to be `c?.name ?? [first, middle, last]
// .filter(Boolean).join(' ') ?? L('nameFallback')` — `.join(' ')` on an all-empty
// array returns `''`, which is NOT nullish, so the `??` fallback was unreachable
// and a nameless candidate rendered a blank 24pt heading. resolveCvName checks
// truthiness explicitly so the fallback label actually reaches the page.
describe('resolveCvName', () => {
  const L = makeCvLabeller()

  it('uses the explicit name when present', () => {
    expect(resolveCvName({ name: 'Jan Jansen' }, L)).toBe('Jan Jansen')
  })

  it('composes first/middle/last when no explicit name is set', () => {
    expect(resolveCvName({ firstName: 'Jan', middleName: 'van der', lastName: 'Berg' }, L)).toBe('Jan van der Berg')
  })

  it('falls back to the label for a genuinely nameless candidate (composed name is an empty string, not nullish)', () => {
    expect(resolveCvName({}, L)).toBe('Naam')
    expect(resolveCvName(undefined, L)).toBe('Naam')
  })
})
