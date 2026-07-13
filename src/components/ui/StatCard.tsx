import type { ComponentType, ReactNode } from 'react'
import { useNumberFormat } from '@/lib/formatters'

// StatCard — a simple stat tile (icon + label + value + optional sub-text).
// When onClick is provided the card becomes clickable (hover highlight + pointer cursor).
interface StatCardProps {
  label?: ReactNode
  value?: ReactNode
  sub?: ReactNode
  color?: string
  bg?: string
  icon?: ComponentType<{ size?: number; color?: string }>
  onClick?: () => void
}

export default function StatCard({ label, value, sub, color = 'var(--color-primary)', bg = 'var(--color-primary-bg)', icon: Icon, onClick }: StatCardProps) {
  // Locale-aware grouping (§ FMT-GETAL-1) — a raw number value gets thousands
  // separators for free; callers that already pass a formatted string are untouched.
  const { formatNumber } = useNumberFormat()
  const displayValue = typeof value === 'number' ? formatNumber(value) : value
  return (
    <div
      className="flex flex-col gap-3 p-5 bg-[var(--surface)] rounded-xl"
      style={{ border: '1px solid var(--border)', cursor: onClick ? 'pointer' : undefined, transition: 'background 0.1s' }}
      onClick={onClick}
      onMouseEnter={onClick ? e => (e.currentTarget.style.background = 'var(--hover-bg)') : undefined}
      onMouseLeave={onClick ? e => (e.currentTarget.style.background = 'var(--surface)') : undefined}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
            style={{ width: 36, height: 36, background: bg }}>
            <Icon size={16} color={color} />
          </div>
        )}
      </div>
      <div>
        <div className="mb-1 font-semibold leading-none"
          style={{ fontSize: 26, color: 'var(--text)', letterSpacing: '-0.5px' }}>
          {displayValue}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11, color: '#C4B5FD', marginTop: 3, fontWeight: 500 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}
