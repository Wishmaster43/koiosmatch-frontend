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

// Card chrome — mirrors the drill-down ProfileTab exactly (11px uppercase muted
// heading above a bordered surface card) so the modal reads as the same system (§3A).
export const cardHead: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
export const cardBox: CSSProperties = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }
// One-line field pairing (§3A: short fields two-up) — a grid row with the given column spec.
export const row = (cols: string): CSSProperties => ({ display: 'grid', gridTemplateColumns: cols, gap: 12 })
