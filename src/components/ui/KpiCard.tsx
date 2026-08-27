/**
 * KpiCard — a single KPI tile: label, big value, optional delta arrow (up/down),
 * icon, and an optional click handler (e.g. to drill down). Shows a skeleton when loading.
 */
import type { ComponentType, ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useNumberFormat } from '@/lib/formatters'
import { interactive } from '@/lib/a11y'

interface KpiCardProps {
  label?: ReactNode
  value?: ReactNode
  delta?: number
  icon?: ComponentType<{ size?: number; color?: string }>
  iconBg?: string
  iconColor?: string
  loading?: boolean
  onClick?: () => void
  note?: ReactNode
}

// See the file's top doc above for the tile contract; a numeric value gets locale-aware thousands separators, a pre-formatted string passes through untouched.
export default function KpiCard({ label, value, delta, icon: Icon, iconBg, iconColor, loading = false, onClick, note }: KpiCardProps) {
  const isPositive = (delta ?? 0) > 0
  const isNeutral  = delta === 0 || delta === undefined
  // Locale-aware grouping (§ FMT-GETAL-1) — a raw number value gets thousands
  // separators for free; callers that already pass a formatted string are untouched.
  const { formatNumber } = useNumberFormat()
  const displayValue = typeof value === 'number' ? formatNumber(value) : value

  if (loading) {
    return (
      <div className="p-5 bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <div className="w-10 h-10 mb-4 bg-gray-100 rounded-lg animate-pulse" />
        <div className="w-16 mb-1 bg-gray-100 rounded h-7 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-28 animate-pulse" />
      </div>
    )
  }

  // Stays a <div> (its children are block-level tiles, not valid <button> content)
  // but gets full button semantics + Enter/Space via the shared `interactive()`
  // helper — only when `onClick` exists, so a non-clickable card is never
  // focusable (WCAG 2.1.1 Keyboard, 4.1.2 Name/Role/Value).
  return (
    <div
      className="flex flex-col gap-3 p-5 bg-[var(--surface)] rounded-xl"
      style={{
        border: '1px solid var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow var(--motion-fast)',
      }}
      {...interactive(onClick)}
      // HUISSTIJL-1: resting-card role — hover lift uses the same card shadow tier.
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = 'var(--shadow-float)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = 'none')}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
          style={{ width: 40, height: 40, background: iconBg }}>
          {Icon && <Icon size={18} color={iconColor} />}
        </div>
        {/* Delta pill: text sits on the semantic pastel, so it reads via the on-*-bg ink twin (AA on that fill), not the raw token. */}
        {!isNeutral && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: isPositive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: isPositive ? 'var(--color-on-success-bg)' : 'var(--color-on-danger-bg)' }}>
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span style={{ fontSize: 11, fontWeight: 600 }}>
              {isPositive ? `+${delta}` : delta}%
            </span>
          </div>
        )}
      </div>
      <div>
        <div className="mb-1 font-semibold leading-none"
          style={{ fontSize: 26, color: 'var(--text)', letterSpacing: '-0.5px' }}>
          {displayValue ?? '—'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
        {note && (
          <div style={{ fontSize: 11, color: 'var(--color-violet)', marginTop: 3, fontWeight: 500 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  )
}
