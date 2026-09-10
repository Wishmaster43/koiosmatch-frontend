/**
 * entityNoteLabels — the eight SharedNotesTab labels every notes-tab-family
 * consumer resolves identically (only the caller's own i18n namespace and key
 * SET differ): EntityNotesTab (match/task), vacancies NotesTab and
 * VacancyNotesPopout all spread this into their own `labels` prop, adding
 * whichever extra keys their own surface needs (loadError/retry, edit/
 * deleteNote/deleteConfirm) locally (§5: strings stay resolved in the
 * CALLER's own t()).
 */
export function entityNoteLabels(t: (key: string) => string) {
  return {
    notes: t('notes.title'),
    newNote: t('notes.new'),
    type: t('notes.type'),
    save: t('notes.save'),
    cancel: t('notes.cancel'),
    notesEmpty: t('notes.empty'),
    notePlaceholder: () => t('notes.placeholder'),
    searchPlaceholder: t('notes.searchPlaceholder'),
  }
}
