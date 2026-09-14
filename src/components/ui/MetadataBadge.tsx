/**
 * MetadataBadge — generic badge for channel, status, or any key-value metadata.
 * Renders a coloured pill with an icon; an unrecognised/missing value falls back
 * to neutral. Identical DOM across messageParts, runFormat, and future users.
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// One badge's visual treatment.
export interface BadgeMeta {
  bg: string
  color: string
  Icon: LucideIcon
}

export default function MetadataBadge({
  value,
  meta,
  labelOf,
  fallbackIcon: FallbackIcon,
  title,
}: {
  value?: string
  meta: Record<string, BadgeMeta>
  labelOf: (key: string | undefined) => ReactNode
  fallbackIcon?: LucideIcon
  // Optional hover text (F7: a blocked run's reason), also read as sr-only text
  // AFTER the visible label — never replaces the badge's accessible name.
  title?: string
}) {
  const key = value?.toLowerCase()
  // Unknown or missing value: the neutral pill the three former badges fell back to.
  const m = (key ? meta[key] : undefined) ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)', Icon: FallbackIcon }
  const Icon = m.Icon
  // A missing value renders the dash the three former badges rendered; labelOf only sees a real key.
  const label = value ? labelOf(key) : '—'

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: m.bg,
        color: m.color,
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={10} />}
      {label}
      {/* sr-only reason text AFTER the visible label — the accessible name stays
          total (label + reason), never replaced by an aria-label override. */}
      {title && <span className="sr-only">{title}</span>}
    </span>
  )
}
