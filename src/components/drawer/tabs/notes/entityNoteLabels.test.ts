// entityNoteLabels — asserts every key calls through the given t() with the exact
// key string (the shared clone this replaces across EntityNotesTab, vacancies
// NotesTab and VacancyNotesPopout — DRY round 11, NOTES2).
import { describe, it, expect, vi } from 'vitest'
import { entityNoteLabels } from './entityNoteLabels'

describe('entityNoteLabels', () => {
  it('resolves each of the eight labels through the given t()', () => {
    const t = vi.fn((key: string) => `translated:${key}`)
    const labels = entityNoteLabels(t)
    expect(labels.notes).toBe('translated:notes.title')
    expect(labels.newNote).toBe('translated:notes.new')
    expect(labels.type).toBe('translated:notes.type')
    expect(labels.save).toBe('translated:notes.save')
    expect(labels.cancel).toBe('translated:notes.cancel')
    expect(labels.notesEmpty).toBe('translated:notes.empty')
    expect(labels.notePlaceholder()).toBe('translated:notes.placeholder')
    expect(labels.searchPlaceholder).toBe('translated:notes.searchPlaceholder')
  })
})
