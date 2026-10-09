/**
 * lookupIcons — the value mark renders the icon the backend serves (LOOKUP-ICONEN-1 seeds
 * 375 values with distinct lucide names); measured 14-09 09:29: 51 of the seeded names fell
 * back to the Tag glyph because the resolver only knew the curated map (six statuses → two
 * distinct glyphs on screen). Any lucide name resolves now; garbage still falls back.
 */
import { describe, it, expect } from 'vitest'
import { Tag, Calendar } from 'lucide-react'
import { GENERIC_LOOKUP_ICON_NAMES, SEEDED_LOOKUP_ICON_NAMES, resolveGenericLookupIcon } from './lookupIcons'

describe('resolveGenericLookupIcon', () => {
  it('resolves a curated name, a seeded lucide name outside the curated map, and falls back only on garbage', () => {
    expect(resolveGenericLookupIcon('calendar')).toBe(Calendar)
    // Names outside the curated map resolve to a lazy wrapper (N-003), never the fallback.
    expect(resolveGenericLookupIcon('signal-low').displayName).toBe('LazyLucide(signal-low)')
    expect(resolveGenericLookupIcon('venus-and-mars').displayName).toBe('LazyLucide(venus-and-mars)')
    expect(resolveGenericLookupIcon('no-such-icon')).toBe(Tag)
    expect(resolveGenericLookupIcon(null)).toBe(Tag)
  })

  it('offers every seeded name in the picker exactly once, none of them collapsing to the fallback', () => {
    expect(new Set(GENERIC_LOOKUP_ICON_NAMES).size).toBe(GENERIC_LOOKUP_ICON_NAMES.length)
    for (const name of SEEDED_LOOKUP_ICON_NAMES) {
      expect(GENERIC_LOOKUP_ICON_NAMES).toContain(name)
      expect(resolveGenericLookupIcon(name)).not.toBe(Tag)
    }
  })
})
