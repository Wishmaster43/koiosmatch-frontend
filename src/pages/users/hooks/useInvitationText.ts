/** useInvitationText: the invitation status sentence with DD-MM-YYYY dates. */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import type { UserInvitation } from '@/types/api'

// Builds the status sentence with DD-MM-YYYY dates via the house formatter.
export function useInvitationText(invitation?: UserInvitation | null): string | null {
  const { t } = useTranslation('users')
  const { formatDate } = useDateFormat()
  if (!invitation) return null
  return t(`invite.status.${invitation.status}`, {
    sent: invitation.sent_at ? formatDate(invitation.sent_at) : '',
    expires: invitation.expires_at ? formatDate(invitation.expires_at) : '',
  })
}
