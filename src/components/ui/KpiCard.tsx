/**
 * KpiCard — a single KPI tile: label, big value, optional delta arrow (up/down),
 * icon, and an optional click handler (e.g. to drill down). Shows a skeleton when loading.
 */
import type { ComponentType, ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

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

export default function KpiCard({ label, value, delta, icon: Icon, iconBg, iconColor, loading = false, onClick, note }: KpiCardProps) {
  const isPositive = (delta ?? 0) > 0
  const isNeutral  = delta === 0 || delta === undefined

  if (loading) {
    return (
      <div className="p-5 bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <div className="w-10 h-10 mb-4 bg-gray-100 rounded-lg animate-pulse" />
        <div className="w-16 mb-1 bg-gray-100 rounded h-7 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-28 animate-pulse" />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-3 p-5 bg-[var(--surface)] rounded-xl"
      style={{
        border: '1px solid var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = 'none')}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
          style={{ width: 40, height: 40, background: iconBg }}>
          {Icon && <Icon size={18} color={iconColor} />}
        </div>
        {!isNeutral && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: isPositive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
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
          {value ?? '—'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
        {note && (
          <div style={{ fontSize: 11, color: '#A78BFA', marginTop: 3, fontWeight: 500 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  )
}
