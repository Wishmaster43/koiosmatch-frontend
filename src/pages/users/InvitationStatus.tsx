/**
 * InvitationStatus — shared invitation-state pieces (BE FOLLOW-UP-2910-1 item 2):
 * the sentence hook, the read-only modal row and the subtle table icon.
 */
import { useTranslation } from 'react-i18next'
import { Mail, MailWarning } from 'lucide-react'
import { FieldRow } from '@/components/forms/fields'
import { BodyText } from '@/components/ui/typography'
import type { UserInvitation } from '@/types/api'
import { useInvitationText } from './hooks/useInvitationText'

// Read-only label-left row for the edit modal; renders nothing for an older BE.
export function InvitationStatusRow({ invitation }: { invitation?: UserInvitation | null }) {
  const { t } = useTranslation('users')
  const text = useInvitationText(invitation)
  if (!text) return null
  return (
    <FieldRow label={t('invite.statusLabel')}>
      {/* Plain text sits level with the label, which is padded for a 32px input (Opus lens, lane D). */}
      <div style={{ minHeight: 32, display: 'flex', alignItems: 'center' }}><BodyText>{text}</BodyText></div>
    </FieldRow>
  )
}

// Table hint after the name: pending and expired only, accepted/none show nothing.
export function InvitationIcon({ invitation }: { invitation?: UserInvitation | null }) {
  const text = useInvitationText(invitation)
  const status = invitation?.status
  if (!text || (status !== 'pending' && status !== 'expired')) return null
  const Icon = status === 'expired' ? MailWarning : Mail
  return (
    <span role="img" aria-label={text} title={text} style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
      <Icon size={13} aria-hidden="true" />
    </span>
  )
}
