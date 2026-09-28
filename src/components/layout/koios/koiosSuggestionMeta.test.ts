/**
 * koiosSuggestionMeta — pure lookup tests (no i18n, no DOM). CMBE addendum
 * (28-09): the icon is keyed by the action's own `key` first, falling back to
 * the registry `tool` name, then a generic glyph.
 */
import { describe, it, expect } from 'vitest'
import { Search, Play } from 'lucide-react'
import { toolIcon, reasonKey, reasonShortKey, suggestionKey, TOOL_ICONS } from './koiosSuggestionMeta'

describe('koiosSuggestionMeta', () => {
  it('keys a parked action by its pending_action ref id, else by kind+title — never the array index', () => {
    const parked = { kind: 'pending_action' as const, title: 'x', body: '', refs: [{ type: 'pending_action', id: 'pa-9', label: 'x' }] }
    const descriptor = { kind: 'task_overdue' as const, title: 'Bel Ahmed', body: '', refs: [] }
    expect(suggestionKey(parked)).toBe('pa:pa-9')
    expect(suggestionKey(descriptor)).toBe('task_overdue:Bel Ahmed')
  })

  it('resolves a known action to its own icon by `key`', () => {
    expect(toolIcon({ key: 'search_candidates' })).toBe(TOOL_ICONS.search_candidates)
    expect(toolIcon({ key: 'search_candidates' })).toBe(Search)
  })

  it('falls back to the registry `tool` name when the key is unknown', () => {
    expect(toolIcon({ key: 'some_future_key', tool: 'zoek_kandidaten' })).toBe(Search)
  })

  it('falls back to the generic "run" glyph when neither key nor tool is known', () => {
    expect(toolIcon({ key: 'nope', tool: 'nope' })).toBe(Play)
    expect(toolIcon(undefined)).toBe(Play)
  })

  it('builds the per-kind reason and reasonShort keys', () => {
    expect(reasonKey('task_overdue')).toBe('koios.assistant.reason.task_overdue')
    expect(reasonShortKey('candidate_no_contact')).toBe('koios.assistant.reasonShort.candidate_no_contact')
  })
})
