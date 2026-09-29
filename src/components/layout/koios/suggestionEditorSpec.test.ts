/**
 * suggestionEditorSpec — pins the field spec per action key
 * (TASK-CREATE-EDIT-1) and the due_date fallback for an unrecognised key.
 */
import { describe, it, expect } from 'vitest'
import { EDITOR_FIELDS, editorFieldsForAction } from './suggestionEditorSpec'

describe('EDITOR_FIELDS', () => {
  it('reschedule_task carries the due_date field only', () => {
    expect(EDITOR_FIELDS.reschedule_task).toEqual([{ key: 'due_date' }])
  })

  it('create_task carries title, due_date and priority in that order', () => {
    expect(EDITOR_FIELDS.create_task).toEqual([{ key: 'title' }, { key: 'due_date' }, { key: 'priority' }])
  })
})

describe('editorFieldsForAction', () => {
  it('resolves a known key to its spec regardless of due_date presence', () => {
    expect(editorFieldsForAction('create_task', false)).toEqual(EDITOR_FIELDS.create_task)
    expect(editorFieldsForAction('reschedule_task', false)).toEqual(EDITOR_FIELDS.reschedule_task)
  })

  it('an unknown key with no due_date has no editor', () => {
    expect(editorFieldsForAction('unknown_key', false)).toBeUndefined()
    expect(editorFieldsForAction(undefined, false)).toBeUndefined()
  })

  it('an unknown key carrying a due_date falls back to the due-date-only editor', () => {
    expect(editorFieldsForAction('unknown_key', true)).toEqual([{ key: 'due_date' }])
    expect(editorFieldsForAction(undefined, true)).toEqual([{ key: 'due_date' }])
  })
})
