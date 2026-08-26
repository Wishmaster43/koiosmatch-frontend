/**
 * Spinner — the ONE loading indicator (HUISSTIJL-1; measured 19-08: 99
 * hand-rolled `Loader2 + animate-spin` copies). Decorative by default — the
 * SURFACE announces loading via its own text/aria-busy; pass `label` only when
 * the spinner is the sole signal, and it becomes the accessible name.
 */
import { Loader2 } from 'lucide-react'

// The shared loading spinner; decorative unless a.
// `label` is passed, which promotes it to the accessible loading announcement.
export default function Spinner({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <Loader2 size={size} className="animate-spin"
      aria-hidden={label ? undefined : true}
      aria-label={label} role={label ? 'status' : undefined}
      style={{ flexShrink: 0 }} />
  )
}
