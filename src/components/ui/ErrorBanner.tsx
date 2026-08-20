import type { ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RotateCcw, X } from 'lucide-react'

/**
 * ErrorBanner — inline error block, token-styled for light/dark (§4). Replaces the
 * ad-hoc `bg-red-50 / text-red-600` banners duplicated across pages (DUP-2).
 * role="alert" so assistive tech announces it (§6). `onRetry`/`onDismiss` are optional —
 * pass either (or both) to offer a "try again" / close action without hand-rolling a button.
 */
interface ErrorBannerProps {
  children: ReactNode
  style?: CSSProperties
  onRetry?: () => void
  onDismiss?: () => void
  retryLabel?: string
  dismissLabel?: string
}

export default function ErrorBanner({ children, style, onRetry, onDismiss, retryLabel, dismissLabel }: ErrorBannerProps) {
  const { t } = useTranslation('common')
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
