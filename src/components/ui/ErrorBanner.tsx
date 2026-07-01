import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * ErrorBanner — inline error block, token-styled for light/dark (§4). Replaces the
 * ad-hoc `bg-red-50 / text-red-600` banners duplicated across pages (DUP-2).
 * role="alert" so assistive tech announces it (§6).
 */
export default function ErrorBanner({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, fontSize: 13,
      background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)',
      ...style,
    }}>
      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  )
}
