// ApplicationFieldRow — the shared label-LEFT field row for the applications
// add-modal family (CLONE-BY-CONSTRUCTION-1, §16): DrawerAddApplicationModal,
// PageAddApplicationModal and SearchPickField each hand-rolled an identical
// `fieldRow`/`fieldControl` style pair — extracted once here and adopted by
// all three instead of a third/fourth copy.
import type { ReactNode } from 'react'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { requiredMark } from '@/components/forms/fields'
import { fieldRow, fieldControl } from './applicationFieldRowStyles'

// Full row: label (+ required marker) left, control right, optional inline
// error line below — the shape DrawerAddApplicationModal's phase/owner/source
// pickers already used under the name `ApplicationFieldRow`.
// `spacing`: 'row' (default) keeps the original 14px bottom margin, used where
// the row stacks vertically on its own (DrawerAddApplicationModal). 'none' opts
// out for call sites whose PARENT already owns the spacing (a grid/flex `gap`,
// e.g. PageAddApplicationModal's owner|phase row and the locked-vacancy cell) —
// without it the render silently grew 14px there (verifier finding, SCHERMWAARHEID-1).
export function ApplicationFieldRow({ fieldId, label, required, error, errorText, children, spacing = 'row' }: {
  fieldId: string; label: ReactNode; required?: boolean; error?: boolean; errorText?: ReactNode; children: ReactNode
  spacing?: 'row' | 'none'
}) {
  return (
    <div style={{ marginBottom: spacing === 'none' ? 0 : 14 }}>
      <div style={fieldRow}>
        {/* A plain labelled <div>, never a <label for>: the select atoms reference it through
            aria-labelledby together with their own trigger, so the accessible name reads
            "label + current value" (a screen reader hears what is picked). A <label for>
            makes the name computation drop that self-reference and the value goes silent. */}
        <div id={`${fieldId}-label`} style={CANON_LABEL_STYLE}>{label}{required && requiredMark}</div>
        <div style={fieldControl}>{children}</div>
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>
          {errorText}
        </div>
      )}
    </div>
  )
}
