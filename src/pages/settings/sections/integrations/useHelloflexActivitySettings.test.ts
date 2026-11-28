/**
 * useHelloflexActivitySettings pure functions (HF-ACTIVITY-ROWS-CARD-FE-1): the blob → draft reading and the draft → wire
 * form that the card saves, pinned on the edge cases of BE HelloFlexActivityRules (zero and leading zeros accepted as
 * digits, a list is not a map, a non-string map value is a row without a note type, a negative default reads as blank).
 */
import { describe, it, expect } from 'vitest'
import { draftFromBlob, wireOf, OWNER_KEY, TYPE_MAP_KEY, DEFAULTS_KEY } from './useHelloflexActivitySettings'

const BLANK_DEFAULTS = { typeId: '', priorityId: '', entityStateId: '', subjectId: '', entityTypeId: '' }

describe('draftFromBlob', () => {
  it('reads a JSON string and a decoded object alike, ints and digit strings as digits, zero included', () => {
    const draft = draftFromBlob({ [OWNER_KEY]: ' abc ', [TYPE_MAP_KEY]: '{"530":"intake","7":"general"}', [DEFAULTS_KEY]: { typeId: 0, priorityId: '007', subjectId: -3, entityTypeId: 'x' } })
    expect(draft.owner).toBe(' abc ')
    expect(draft.rows).toEqual([{ id: 1, typeId: '7', noteType: 'general' }, { id: 2, typeId: '530', noteType: 'intake' }])
    expect(draft.defaults).toEqual({ ...BLANK_DEFAULTS, typeId: '0', priorityId: '007' })
  })

  it('reads a missing, blank, malformed or list value as empty, and a non-string map value as a row without a note type', () => {
    expect(draftFromBlob({})).toEqual({ owner: '', rows: [], defaults: BLANK_DEFAULTS })
    expect(draftFromBlob({ [TYPE_MAP_KEY]: '  ', [DEFAULTS_KEY]: 'not json' }).rows).toEqual([])
    expect(draftFromBlob({ [TYPE_MAP_KEY]: '["intake"]', [DEFAULTS_KEY]: [1, 2] })).toEqual({ owner: '', rows: [], defaults: BLANK_DEFAULTS })
    expect(draftFromBlob({ [TYPE_MAP_KEY]: { 530: 5 } }).rows).toEqual([{ id: 1, typeId: '530', noteType: '' }])
    expect(draftFromBlob({ [OWNER_KEY]: 42 }).owner).toBe('')
  })
})

describe('wireOf', () => {
  it('trims the owner, sends the map as {digits: slug} and the defaults as integers (leading zeros collapse), blank members dropped', () => {
    const wire = wireOf({ owner: ' 3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b ', rows: [{ id: 1, typeId: '530', noteType: 'intake' }, { id: 2, typeId: '', noteType: '' }], defaults: { ...BLANK_DEFAULTS, typeId: '007', subjectId: '0' } })
    expect(wire).toEqual({ [OWNER_KEY]: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b', [TYPE_MAP_KEY]: '{"530":"intake"}', [DEFAULTS_KEY]: '{"typeId":7,"subjectId":0}' })
  })

  it("sends '' for a blank owner, an empty map and empty defaults (the BE removes the row)", () => {
    expect(wireOf({ owner: '   ', rows: [{ id: 1, typeId: '', noteType: 'intake' }], defaults: BLANK_DEFAULTS })).toEqual({ [OWNER_KEY]: '', [TYPE_MAP_KEY]: '', [DEFAULTS_KEY]: '' })
  })
})
