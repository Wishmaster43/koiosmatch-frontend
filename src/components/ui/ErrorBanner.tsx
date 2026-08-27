/**
 * ErrorBanner — inline error block, token-styled for light/dark (§4). Replaces the
 * ad-hoc `bg-red-50 / text-red-600` banners duplicated across pages (DUP-2).
 * role="alert" so assistive tech announces it (§6). `onRetry`/`onDismiss` are optional —
 * pass either (or both) to offer a "try again" / close action without hand-rolling a button.
 */
import type { ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RotateCcw, X } from 'lucide-react'
import Button from './Button'
interface ErrorBannerProps {
  children: ReactNode
  style?: CSSProperties
  onRetry?: () => void
  onDismiss?: () => void
  retryLabel?: string
  dismissLabel?: string
  // 'alert' = the filled danger banner (default); 'subtle' = the calm inline
  // variant for routine load failures inside dashboard cards/widgets (Danny
  // 27-08: a full-width red band per card "kan zo niet") — muted text, small
  // danger icon, ghost retry; same role="alert" semantics.
  variant?: 'alert' | 'subtle'
}

// The shared error-state banner (§3A: always handle error explicitly); retry/dismiss controls render only when their handler is actually given.
export default function ErrorBanner({ children, style, onRetry, onDismiss, retryLabel, dismissLabel, variant = 'alert' }: ErrorBannerProps) {
  const { t } = useTranslation('common')

  // Calm inline face: no filled band, muted prose with a small danger icon and a
  // ghost retry Button — a routine widget failure informs, it never alarms (§4 rust).
  if (variant === 'subtle') {
    return (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12.5, color: 'var(--text-muted)', ...style }}>
        <AlertTriangle size={13} color="var(--color-danger-text)" aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{children}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} style={{ flexShrink: 0 }}>
            <RotateCcw size={12} /> {retryLabel ?? t('error.retry')}
          </Button>
        )}
        {onDismiss && (
          <Button variant="ghost" size="sm" iconOnly aria-label={dismissLabel ?? t('close')} onClick={onDismiss} style={{ flexShrink: 0 }}>
            <X size={13} />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, fontSize: 13,
      // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its
      // own pastel, AA fail (Opus r3.5). Border stays the full-strength danger token.
      background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)', border: '1px solid var(--color-danger)',
      ...style,
    }}>
      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{children}</span>
      {/* Optional retry action — e.g. a failed list load offering "try again". Bespoke
          inline text+icon control that inherits the banner's own ink (not a fixed-height
          action button), pre-existing and out of this ink/tint task's scope. */}
      {onRetry && (
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
        <button onClick={onRetry} style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, background: 'none', border: 'none',
          cursor: 'pointer', color: 'inherit', fontSize: 12.5, fontWeight: 600, padding: '2px 4px',
        }}>
          <RotateCcw size={13} /> {retryLabel ?? t('error.retry')}
        </button>
      )}
      {/* Optional dismiss action — closes the banner without retrying. */}
      {onDismiss && (
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- bespoke icon-only control inheriting the banner's own ink, pre-existing and out of this ink/tint task's scope
        <button onClick={onDismiss} aria-label={dismissLabel ?? t('close')} style={{
          display: 'flex', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2,
        }}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
