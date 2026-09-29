/**
 * RescheduleEditor — kept as a thin re-export (TASK-CREATE-EDIT-1
 * generalised the reschedule-only editor into `SuggestionEditor`, driven by
 * the `suggestionEditorSpec` field map). Existing imports/tests of this file
 * keep working unchanged; the reschedule shape (date only, badge, the exact
 * confirm/cancel contract) is byte-identical, since `SuggestionEditor`
 * resolves any action without a recognised key that still carries a string
 * `due_date` to that same date-only shape.
 */
export { default } from './SuggestionEditor'
