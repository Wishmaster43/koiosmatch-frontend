/**
 * useConfirm — call-site sugar around the shared ConfirmDialog (§0 tech-debt
 * cleanup: replaces window.confirm()). `confirm(message, onConfirm, options)`
 * stages one pending confirmation; render the returned `dialog` element once
 * per component. Keeps every delete/destructive-action call-site to a single
 * line instead of duplicating open/pending state across each file.
 */
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// Options for one staged confirmation (all optional — ConfirmDialog has sane defaults).
interface ConfirmOptions {
  title?: string
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
  /**
   * Optional action for the CANCEL button. Only pass it when cancelling is a real
   * second choice rather than "do nothing" — e.g. "replace the primary contact?"
   * where declining still saves the record, just without the flag. Omitted, cancel
   * closes the dialog and nothing happens, as before.
   */
  onCancel?: () => void
  // Optional rich content under the message (mirrors ConfirmDialog's own
  // `children` — NOTE-UNDO-FE-1 uses it for the previous-version preview).
  children?: ReactNode
}

interface ConfirmState extends ConfirmOptions {
  message: string
  onConfirm: () => void
}

// One in-memory pending confirmation + the dialog element to render for it (see the module doc above); confirm() stages it, ConfirmDialog itself only fires onConfirm when the user actually clicks through.
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)

  // Stage a confirmation — the action only runs after the user clicks Confirm.
  const confirm = useCallback((message: string, onConfirm: () => void, options?: ConfirmOptions) => {
    setState({ message, onConfirm, ...options })
  }, [])

  const dialog = (
    <ConfirmDialog
      open={state != null}
      message={state?.message ?? ''}
      title={state?.title}
      danger={state?.danger}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      onConfirm={() => { state?.onConfirm(); setState(null) }}
      onCancel={() => { state?.onCancel?.(); setState(null) }}
    >
      {state?.children}
    </ConfirmDialog>
  )

  return { confirm, dialog }
}
