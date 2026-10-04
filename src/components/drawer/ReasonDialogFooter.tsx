/**
 * ReasonDialogFooter — the shared tail of a reason-gated confirm dialog: the
 * inline alert error paragraph + the danger ModalFooter row. Extracted
 * (CLONE-BY-CONSTRUCTION-1) once ResolveClaimDialog's tail turned out
 * byte-identical to EraseWithPasswordDialog's — both now compose this one
 * unit instead of carrying the same seven lines twice.
 */
import ModalFooter from '@/components/ui/ModalFooter'
import { captionStyle } from '@/components/ui/typography'

interface Props {
  error: string | null
  onCancel: () => void
  onSubmit: () => void
  cancelLabel: string
  submitLabel: string
  disabled: boolean
  busy: boolean
}

export default function ReasonDialogFooter({ error, onCancel, onSubmit, cancelLabel, submitLabel, disabled, busy }: Props) {
  return (
    <>
      {/* A raw <p> (not the Caption atom) — TypoProps carries no `role`, and this
          line must be announced as an alert (§6). */}
      {error && <p role="alert" style={{ ...captionStyle, marginTop: 8, color: 'var(--color-danger-text)' }}>{error}</p>}
      <div style={{ marginTop: 18 }}>
        <ModalFooter onCancel={onCancel} onSubmit={onSubmit} cancelLabel={cancelLabel}
          submitLabel={submitLabel} disabled={disabled} busy={busy} danger />
      </div>
    </>
  )
}
