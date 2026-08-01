/**
 * Shared field chrome + typed form-field casts for the AddCandidateModal cards.
 * Extracted so every card imports the same typed boundary instead of
 * re-declaring the casts per file (CLAUDE.md §11: no copy-pasted helpers).
 */
import { useContext } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Field as FieldJs, TextField as TextFieldJs, SelectField as SelectFieldJs } from '@/components/forms/fields'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import { CvFilledContext } from './cvFilledContext'

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

// The "came from the CV" chip on a field label — soft-tinted in the primary token,
// never a solid fill (§4 soft-chip convention).
const cvBadge: CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.6,
  padding: '0 5px', borderRadius: 999, textTransform: 'uppercase',
  background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
  color: 'var(--color-primary)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
}

/**
 * CvField — a Field that marks ITSELF when its value came from the CV parser.
 * The whole point of the parse-prefill is that the recruiter CHECKS these values
 * instead of trusting them (AI misreads dates and employers), so the mark is a text
 * badge inside the label — read out by a screen reader via Field's aria-labelledby —
 * plus an outline. Never colour alone (§6), and `outline` so nothing shifts layout.
 * Unmarked it renders exactly as a plain Field.
 */
export function CvField({ name, label, required, children }: {
  name: string; label: ReactNode; required?: boolean; children: ReactNode
}) {
  const { t } = useTranslation('candidates')
  const marked = useContext(CvFilledContext).has(name)
  if (!marked) return <Field label={label} required={required}>{children}</Field>
  return (
    <div style={{ outline: '1px solid color-mix(in srgb, var(--color-primary) 45%, transparent)', outlineOffset: 4, borderRadius: 8 }}>
      <Field required={required} label={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {label}
          <span style={cvBadge} title={t('modal.cv.badgeTitle')}>{t('modal.cv.badge')}</span>
        </span>
      }>
        {children}
      </Field>
    </div>
  )
}

// Card chrome + row-grid builder — the shared §3A card idiom (11px uppercase
// muted heading above a bordered surface). Re-exported from the one shared
// module every wide create-modal uses (CLAUDE.md §11: no per-entity copies)
// so this modal, +Match, +Klant, +Vacature, … stay pixel-identical.
export { cardHead, cardBox, row } from '@/components/ui/modalCards'
