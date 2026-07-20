import { useCallback, useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// Options for one staged confirmation (all optional — ConfirmDialog has sane defaults).
interface ConfirmOptions {
  title?: string
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
}

interface ConfirmState extends ConfirmOptions {
  message: string
  onConfirm: () => void
}

/**
 * useConfirm — call-site sugar around the shared ConfirmDialog (§0 restschuld:
 * replaces window.confirm()). `confirm(message, onConfirm, options)` stages one
 * pending confirmation; render the returned `dialog` element once per component.
 * Keeps every delete/destructive-action call-site to a single line instead of
 * duplicating open/pending state across each file.
 */
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
      onCancel={() => setState(null)}
    />
  )

  return { confirm, dialog }
}
