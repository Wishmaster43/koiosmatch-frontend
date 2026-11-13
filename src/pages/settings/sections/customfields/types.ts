// Shared types for the custom-fields editor.

// Field types the backend supports.
export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'boolean', 'select'] as const
export type FieldType = typeof FIELD_TYPES[number]

// Raw definition as the unified /custom-fields endpoint returns it.
export interface CustomFieldDef {
  id: string
  key: string
  type: FieldType
  label_i18n?: Record<string, string>
  options?: string[]
  active?: boolean
  in_use?: boolean
  visible_in_ui?: boolean
}

// The mapped shape this editor renders — a raw def plus the resolved display label
// and the has_data flag (in_use, renamed for the reader's benefit in this file).
export interface CustomField extends CustomFieldDef {
  label: string
  has_data: boolean
}

// Per-field draft while its edit card is expanded — every key optional since it
// only carries what the user actually changed (falls back to the field's own value).
export interface EditForm {
  label?: string
  type?: FieldType
  options?: string
  optionError?: boolean
  active?: boolean
}

// The add-new-field form's own draft state.
export interface NewFieldForm {
  label: string
  key: string
  type: FieldType
  options: string
  optionError: boolean
}

