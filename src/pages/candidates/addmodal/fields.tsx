/**
 * Shared field chrome + typed form-field casts for the AddCandidateModal cards.
 * Extracted so every card imports the same typed boundary instead of
 * re-declaring the casts per file (CLAUDE.md §11: no copy-pasted helpers).
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { Field as FieldJs, TextField as TextFieldJs, SelectField as SelectFieldJs } from '@/components/forms/fields'
import CreatableSelectJs from '@/components/ui/CreatableSelect'

// Shared form fields are still untyped JS — declare the props this modal uses (typed boundary).
export const Field = FieldJs as ComponentType<{ label?: ReactNode; required?: boolean; children?: ReactNode }>
export const TextField = TextFieldJs as ComponentType<{ value?: string; onChange?: (v: string) => void; placeholder?: string; type?: string; error?: boolean; style?: CSSProperties }>
export const SelectField = SelectFieldJs as ComponentType<{ value?: string; onChange?: (v: string) => void; placeholder?: string; options?: Array<{ value: string; label: string } | string> }>
// Searchable combobox (drill-down pattern) — still untyped JS, same cast as ProfileTab.
const RawCreatableSelect = CreatableSelectJs as unknown as ComponentType<Record<string, unknown>>
// Modal comboboxes match the text-input footprint (Danny 23-07: 'functietitel en
// geslacht zijn kleiner in hoogte' — 6px/12px trigger vs 8px/13px inputs).
export const CreatableSelect: ComponentType<Record<string, unknown>> = (props) => (
  <RawCreatableSelect style={{ padding: '8px 11px', borderRadius: 8, fontSize: 13 }} {...props} />
)

// A plain value/label pair — the shape every lookup-backed dropdown option boils down to.
export interface FieldOption { value: string; label: string }

// Card chrome + row-grid builder — the shared §3A card idiom (11px uppercase
// muted heading above a bordered surface). Re-exported from the one shared
// module every wide create-modal uses (CLAUDE.md §11: no per-entity copies)
// so this modal, +Match, +Klant, +Vacature, … stay pixel-identical.
export { cardHead, cardBox, row } from '@/components/ui/modalCards'
