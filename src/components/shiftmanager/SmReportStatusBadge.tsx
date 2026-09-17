/**
 * SmReportStatusBadge — reusable inline status badge for report headers showing
 * a count and label. Renders as a pill with optional coloured dot and background.
 */
import { useNumberFormat } from '@/lib/formatters'

interface SmReportStatusBadgeProps {
  count: number
  label: string
  color?: string
  bg?: string
  withDot?: boolean
  withBg?: boolean
}

export default function SmReportStatusBadge({
  count,
  label,
  color,
  bg,
  withDot = true,
  withBg = true,
}: SmReportStatusBadgeProps) {
  // GETALLEN-1: the count renders through the active-locale formatter, not raw interpolation.
  const { formatNumber } = useNumberFormat()
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: withBg && bg ? bg : 'var(--hover-bg)',
        color: withBg && color ? color : 'var(--text-muted)',
        borderRadius: 999,
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {/* Optional coloured dot. */}
      {withDot && color && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      {formatNumber(count)} {label}
    </span>
  )
}
