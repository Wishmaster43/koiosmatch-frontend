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
export function ApplicationFieldRow({ fieldId, label, required, error, errorText, children }: {
  fieldId: string; label: ReactNode; required?: boolean; error?: boolean; errorText?: ReactNode; children: ReactNode
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={fieldRow}>
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
