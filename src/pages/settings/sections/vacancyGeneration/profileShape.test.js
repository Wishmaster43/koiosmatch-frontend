/**
 * profileShape — mappers toApiProfile / fromApiProfile
 */
import { describe, it, expect } from 'vitest'
import { toApiProfile, fromApiProfile } from './profileShape'

const emptyDraft = () => ({
  name: '',
  is_default: false,
  priority: 10,
  matcher: { location_ids: [], contract_types: [], function_titles: [], industries: [] },
  content: {
    template: '',
    tone_of_voice: 'neutral',
    length: 'medium',
    language: '',
    allow_emoji: false,
    brand_instructions: '',
    forbidden_words: [],
    content_block_ids: [],
  },
})

const profile = (over = {}) => ({
  id: 'p1',
  name: 'Zorg — ochtenddiensten',
  is_default: false,
  priority: 15,
  location_ids: ['loc1'],
  contract_types: ['ZZP Flex'],
  function_titles: ['Verzorgende IG'],
  industries: ['Zorg'],
  template: 'A vacancy for {{title}}',
  tone_of_voice: 'professional',
  length: 'long',
  language: 'Nederlands',
  allow_emoji: true,
  brand_instructions: 'Always be friendly',
  forbidden_words: ['bad', 'words'],
  content_block_ids: ['block1', 'block2'],
  ...over,
})

describe('profileShape — toApiProfile', () => {
  it('flattens a nested draft to the flat API shape with all 12 matcher/content keys', () => {
    const draft = emptyDraft()
    draft.name = 'Test Profile'
    draft.is_default = true
    draft.priority = 20
    draft.matcher.location_ids = ['loc1', 'loc2']
    draft.matcher.contract_types = ['ZZP', 'Flex']
    draft.matcher.function_titles = ['Nurse']
    draft.matcher.industries = ['Healthcare']
    draft.content.template = 'Template text'
    draft.content.tone_of_voice = 'friendly'
    draft.content.length = 'short'
    draft.content.language = 'Dutch'
    draft.content.allow_emoji = true
    draft.content.brand_instructions = 'Brand rules'
    draft.content.forbidden_words = ['no', 'bad']
    draft.content.content_block_ids = ['b1', 'b2']

    const flat = toApiProfile(draft)

    // Top-level identity fields
    expect(flat.name).toBe('Test Profile')
    expect(flat.is_default).toBe(true)
    expect(flat.priority).toBe(20)
    // Matcher fields (flattened)
    expect(flat.location_ids).toEqual(['loc1', 'loc2'])
    expect(flat.contract_types).toEqual(['ZZP', 'Flex'])
    expect(flat.function_titles).toEqual(['Nurse'])
    expect(flat.industries).toEqual(['Healthcare'])
    // Content fields (flattened)
    expect(flat.template).toBe('Template text')
    expect(flat.tone_of_voice).toBe('friendly')
    expect(flat.length).toBe('short')
    expect(flat.language).toBe('Dutch')
    expect(flat.allow_emoji).toBe(true)
    expect(flat.brand_instructions).toBe('Brand rules')
    expect(flat.forbidden_words).toEqual(['no', 'bad'])
    expect(flat.content_block_ids).toEqual(['b1', 'b2'])
  })

  it('fills empty arrays and defaults for missing matcher/content keys', () => {
    const draft = { name: 'Test', is_default: false, priority: 1, matcher: {}, content: {} }
    const flat = toApiProfile(draft)

    // Matcher arrays default to []
    expect(flat.location_ids).toEqual([])
    expect(flat.contract_types).toEqual([])
    expect(flat.function_titles).toEqual([])
    expect(flat.industries).toEqual([])
    // Content values default to calm settings
    expect(flat.template).toBe('')
    expect(flat.tone_of_voice).toBe('neutral')
    expect(flat.length).toBe('medium')
    expect(flat.language).toBe('')
    expect(flat.allow_emoji).toBe(false)
    expect(flat.brand_instructions).toBe('')
    expect(flat.forbidden_words).toEqual([])
    expect(flat.content_block_ids).toEqual([])
  })
})

describe('profileShape — fromApiProfile', () => {
  it('nests a flat API profile to the editor draft shape with all 12 keys', () => {
    const flat = profile()
    const draft = fromApiProfile(flat)

    // Top-level
    expect(draft.name).toBe('Zorg — ochtenddiensten')
    expect(draft.is_default).toBe(false)
    expect(draft.priority).toBe(15)
    // Matcher nested
    expect(draft.matcher.location_ids).toEqual(['loc1'])
    expect(draft.matcher.contract_types).toEqual(['ZZP Flex'])
    expect(draft.matcher.function_titles).toEqual(['Verzorgende IG'])
    expect(draft.matcher.industries).toEqual(['Zorg'])
    // Content nested
    expect(draft.content.template).toBe('A vacancy for {{title}}')
    expect(draft.content.tone_of_voice).toBe('professional')
    expect(draft.content.length).toBe('long')
    expect(draft.content.language).toBe('Nederlands')
    expect(draft.content.allow_emoji).toBe(true)
    expect(draft.content.brand_instructions).toBe('Always be friendly')
    expect(draft.content.forbidden_words).toEqual(['bad', 'words'])
    expect(draft.content.content_block_ids).toEqual(['block1', 'block2'])
  })

  it('backfills missing keys with defaults (for profiles predating new fields)', () => {
    const flat = { id: 'p1', name: 'Old Profile', is_default: false, priority: 10 }
    const draft = fromApiProfile(flat)

    // Matcher backfilled
    expect(draft.matcher.location_ids).toEqual([])
    expect(draft.matcher.contract_types).toEqual([])
    expect(draft.matcher.function_titles).toEqual([])
    expect(draft.matcher.industries).toEqual([])
    // Content backfilled to calm defaults
    expect(draft.content.template).toBe('')
    expect(draft.content.tone_of_voice).toBe('neutral')
    expect(draft.content.length).toBe('medium')
    expect(draft.content.language).toBe('')
    expect(draft.content.allow_emoji).toBe(false)
    expect(draft.content.brand_instructions).toBe('')
    expect(draft.content.forbidden_words).toEqual([])
    expect(draft.content.content_block_ids).toEqual([])
  })

  it('coerces booleans correctly (is_default, allow_emoji)', () => {
    const flat = profile({ is_default: 1, allow_emoji: 0 })
    const draft = fromApiProfile(flat)

    expect(draft.is_default).toBe(true)
    expect(draft.content.allow_emoji).toBe(false)
  })
})

describe('profileShape — round-trip (draft → flat → draft)', () => {
  it('a draft flattened and re-nested recovers the original structure', () => {
    const original = emptyDraft()
    original.name = 'Round Trip'
    original.is_default = true
    original.priority = 25
    original.matcher.location_ids = ['loc1']
    original.matcher.contract_types = ['ZZP']
    original.matcher.function_titles = ['Title1']
    original.matcher.industries = ['Zorg']
    original.content.template = 'Template'
    original.content.tone_of_voice = 'friendly'
    original.content.length = 'short'
    original.content.language = 'NL'
    original.content.allow_emoji = true
    original.content.brand_instructions = 'Rules'
    original.content.forbidden_words = ['bad']
    original.content.content_block_ids = ['b1']

    const flat = toApiProfile(original)
    const recovered = fromApiProfile(flat)

    expect(recovered).toEqual(original)
  })
})
