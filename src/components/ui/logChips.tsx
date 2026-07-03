/**
 * logShared — small building blocks shared by every in/out log (email, WhatsApp, …):
 * a soft in/out direction chip and a status chip. Tinted (never solid), tokens only.
 */
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

// Is this an incoming/received message? (accepts the common backend spellings).
export const isInbound = (direction?: string) =>
  direction === 'in' || direction === 'inbound' || direction === 'received' || direction === 'incoming'

// Soft in/out direction chip.
export function DirectionPill({ direction }: { direction?: string }) {
  const { t } = useTranslation('settings')
  const inbound = isInbound(direction)
  const color = inbound ? 'var(--color-secondary)' : 'var(--color-primary)'
  const Icon = inbound ? ArrowDownLeft : ArrowUpRight
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`, color }}>
      <Icon size={11} />{inbound ? t('log.in') : t('log.out')}
    </span>
  )
}

// Soft status chip; colour by common message statuses (delivered/sent/failed/…).
export function StatusPill({ status }: { status?: string }) {
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const s = status.toLowerCase()
  const color = /fail|error|bounce|reject/.test(s) ? 'var(--color-danger)'
    : /deliver|sent|read|ok|success/.test(s) ? 'var(--color-success)'
    : /queue|pending|sending/.test(s) ? 'var(--color-warning)'
    : 'var(--text-muted)'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`, color }}>
      {status}
    </span>
  )
}
