/**
 * usePopoverBox — the shared open/close wiring for a non-portalled workflow-field
 * popover (EventCombobox, MultiSelectField): an Escape layer that closes it
 * (one-stage, before a surrounding focus-trapped modal ever sees the key — see
 * EventCombobox's own doc comment for why), plus the wrapping box ref + onBlur
 * handler that closes it once focus leaves the box entirely. The control's own
 * markup/styles stay per field; this hook owns only the close wiring.
 * (DRY round 11, LAYOUT.)
 */
import { useRef } from 'react'
import type { FocusEvent, RefObject } from 'react'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'

export function usePopoverBox(open: boolean, setOpen: (open: boolean) => void): {
  boxRef: RefObject<HTMLDivElement | null>
  onBlur: (e: FocusEvent<HTMLDivElement>) => void
} {
  const boxRef = useRef<HTMLDivElement>(null)
  // Escape layer: closes this popover (one-stage) before any surrounding modal sees the key.
  useEscapeLayer(open, () => setOpen(false))
  const onBlur = (e: FocusEvent<HTMLDivElement>) => { if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false) }
  return { boxRef, onBlur }
}
