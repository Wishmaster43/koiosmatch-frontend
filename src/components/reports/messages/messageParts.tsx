/**
 * Shared message-table parts: the date-time formatter and the channel/status badge
 * meta + badge components. Used by both MessagesTable and MessageDrawer. Labels
 * resolve via t('messages.channel.*' / '.status.*'). The sortable-column icon now
 * comes from the shared SortableTableHead (§3, reportTableChrome.tsx).
 */
import { MessageCircle, Mail, Phone, CheckCheck, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDateTimeStr } from '@/lib/localDate'
import MetadataBadge, { type BadgeMeta } from '@/components/ui/MetadataBadge'

// Short readable date + time via the ONE shared formatter (heraudit I18N-2).
// eslint-disable-next-line react-refresh/only-export-components -- shared formatter every message table/drawer in this file imports; HMR-nicety warning only
export const formatDT = formatDateTimeStr

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
  sent:       { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', Icon: CheckCheck  },
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
  return (
    <MetadataBadge
      value={channel}
      meta={CHANNEL_META}
      labelOf={(key) => t(`messages.channel.${key}`, { defaultValue: channel })}
      fallbackIcon={MessageCircle}
    />
  )
}

// Coloured status pill with an icon; an unrecognised/missing status falls back to a muted neutral look rather than rendering nothing.
export function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  return (
    <MetadataBadge
      value={status}
      meta={STATUS_META}
      labelOf={(key) => t(`messages.status.${key}`, { defaultValue: status })}
      fallbackIcon={Clock}
    />
  )
}
