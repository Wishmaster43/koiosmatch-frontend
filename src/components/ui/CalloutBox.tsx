/**
 * CalloutBox — the ONE inline banner/callout across Settings (load error, OAuth
 * warning, one-time secret reveal, …). Audit finding: the same warning box (ad-hoc
 * hex #FDE68A border / #92400E text) was copied verbatim across AuditLog/LogView/
 * EmailSettings, and the same success "secret revealed once" box (ad-hoc hex
 * #BBF7D0 border / #166534 text) across ApiKeyDetail/ApiKeyCreate/WebhookDetail/
 * WebhookCreate. Both are now this one component on §4 color-mix tokens — no ad-hoc
 * hex, one look, forever. `title` and `onDismiss` are optional so a plain one-line
 * error message (AuditLog/LogView) and a titled + dismissible reveal box (the
 * apikeys/webhooks secret banners) both render from the same component.
 */
import type { ReactNode } from 'react'

export type CalloutBoxVariant = 'success' | 'warning' | 'info' | 'danger'

interface CalloutBoxProps {
  variant: CalloutBoxVariant
  // Optional bold lead-in line, tinted in the variant colour (e.g. "Secret revealed once").
  title?: ReactNode
  children: ReactNode
  // Optional dismiss control below the content (the apikeys/webhooks reveal boxes).
  onDismiss?: () => void
  dismissLabel?: string
}

// One CSS-var token per variant — background/border derive from it via color-mix (§4),
// never a hardcoded hex. The base --color-* tokens stay vivid in dark mode (index.css),
// so the title/icon colour is theme-aware for free.
const TOKEN: Record<CalloutBoxVariant, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
  danger: 'var(--color-danger)',
}
const TOKEN_BG: Record<CalloutBoxVariant, string> = {
  success: 'var(--color-success-bg)',
  warning: 'var(--color-warning-bg)',
  info: 'var(--color-info-bg)',
  danger: 'var(--color-danger-bg)',
}

export default function CalloutBox({ variant, title, children, onDismiss, dismissLabel }: CalloutBoxProps) {
  const token = TOKEN[variant]
  return (
    <div role={variant === 'danger' || variant === 'warning' ? 'alert' : undefined}
      style={{
        background: TOKEN_BG[variant],
        border: `1px solid color-mix(in srgb, ${token} 40%, transparent)`,
        borderRadius: 10, padding: '12px 14px',
      }}>
      {title && <div style={{ fontSize: 12, fontWeight: 600, color: token, marginBottom: 8 }}>{title}</div>}
      <div style={{ fontSize: 13, color: 'var(--text)' }}>{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss}
          style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {dismissLabel}
        </button>
      )}
    </div>
  )
}
