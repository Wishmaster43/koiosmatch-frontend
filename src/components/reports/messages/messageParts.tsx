/**
 * Shared message-table parts: the date-time formatter, the channel/status badge
 * meta + badge components, and the sortable-column icon. Used by both MessagesTable
 * and MessageDrawer. Labels resolve via t('messages.channel.*' / '.status.*').
 */
import { MessageCircle, Mail, Phone, CheckCheck, Clock, XCircle, AlertTriangle } from 'lucide-react'
import SortCaret from '@/components/ui/SortCaret'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const PAD = (n: number) => String(n).padStart(2, '0')

// eslint-disable-next-line react-refresh/only-export-components -- shared formatter every message table/drawer in this file imports; HMR-nicety warning only
export function formatDT(dt?: string | number | Date | null) {
  if (!dt) return '—'
  const d = new Date(dt)
  return `${PAD(d.getDate())}-${PAD(d.getMonth()+1)}-${d.getFullYear()} ${PAD(d.getHours())}:${PAD(d.getMinutes())}`
}

// One badge's visual treatment.
export interface BadgeMeta { bg: string; color: string; Icon: LucideIcon }

// Channel → colour + icon. Label = t('messages.channel.<key>').
/* eslint-disable no-restricted-syntax -- fixed channel→colour mapping (DATA), mirrors the lookup-colour pattern used elsewhere; these shades have no exact token equivalent */
// eslint-disable-next-line react-refresh/only-export-components -- shared meta map every message table/drawer in this file imports; HMR-nicety warning only
export const CHANNEL_META: Record<string, BadgeMeta> = {
  whatsapp: { bg: '#ECFDF5', color: '#059669', Icon: MessageCircle },
  email:    { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)', Icon: Mail },
  sms:      { bg: '#F5F3FF', color: '#6D28D9', Icon: Phone },
}
/* eslint-enable no-restricted-syntax */

// Status → colour + icon. Label = t('messages.status.<key>').
/* eslint-disable no-restricted-syntax -- fixed status→colour mapping (DATA), mirrors the lookup-colour pattern used elsewhere; these shades have no exact token equivalent */
// eslint-disable-next-line react-refresh/only-export-components -- shared meta map every message table/drawer in this file imports; HMR-nicety warning only
export const STATUS_META: Record<string, BadgeMeta> = {
  sent:       { bg: 'var(--color-success-bg)', color: 'var(--color-success)', Icon: CheckCheck  },
  delivered:  { bg: '#ECFDF5', color: '#059669', Icon: CheckCheck  },
  read:       { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)', Icon: CheckCheck  },
  // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its
  // own pastel, AA fail (Opus r3.5).
  failed:     { bg: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)', Icon: XCircle     },
  pending:    { bg: 'var(--hover-bg)', color: 'var(--text-muted)', Icon: Clock     },
  bounced:    { bg: 'var(--color-warning-bg)', color: '#C2410C', Icon: AlertTriangle },
}
/* eslint-enable no-restricted-syntax */

export function ChannelBadge({ channel }: { channel?: string }) {
  const { t } = useTranslation('reports')
  const key = channel?.toLowerCase()
  const m = (key ? CHANNEL_META[key] : undefined) ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)', Icon: MessageCircle }
  const Icon = m.Icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.bg, color: m.color,
                   fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon size={10} />
      {channel ? t(`messages.channel.${key}`, { defaultValue: channel }) : '—'}
    </span>
  )
}

export function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  const key = status?.toLowerCase()
  const m = (key ? STATUS_META[key] : undefined) ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)', Icon: Clock }
  const Icon = m.Icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.bg, color: m.color,
                   fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon size={10} />
      {status ? t(`messages.status.${key}`, { defaultValue: status }) : '—'}
    </span>
  )
}

export function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  // Delegates to the ONE shared caret recipe (HUISSTIJL-1).
  return <SortCaret active={active} dir={dir} />
}
