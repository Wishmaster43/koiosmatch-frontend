/**
 * DrawerErrorBlock — the danger-tinted "error message" block shared by
 * RunDetailDrawer and MessageDrawer: an AlertTriangle + translated label, then
 * the raw error text in a <pre>. Extracted so the pastel danger-bg/border pair
 * (§4 contrast note: --color-on-danger-bg, not --color-danger, reads AA on the
 * pastel) lives once instead of two hand-copies (DRY round).
 */
import { AlertTriangle } from 'lucide-react'
import type { CSSProperties } from 'react'

export function DrawerErrorBlock({ label, message, style }: { label: string; message: string; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- DATA: danger-border companion colour, mirrors the same literal used elsewhere (EmailSettings/WhatsAppSettings)
    <div style={{ background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 14px', ...style }}>
      {/* Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1
          on its own pastel, AA fail (Opus r3.5). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <AlertTriangle size={13} color="var(--color-on-danger-bg)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-danger-bg)' }}>{label}</span>
      </div>
      <pre style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
        {message}
      </pre>
    </div>
  )
}
