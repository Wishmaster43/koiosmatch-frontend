/**
 * AcceptInvitePage — public page opened from the invitation mail: choose a password to activate the account.
 */
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { safeEmailParam } from '@/lib/safeEmailParam'
import LoginShell from '@/components/auth/LoginShell'
import SetPasswordForm from './SetPasswordForm'

export default function AcceptInvitePage() {
  const { t } = useTranslation('auth')
  const [params] = useSearchParams()
  const email = safeEmailParam(params.get('email'))
  return (
    <LoginShell>
      <SetPasswordForm endpoint="/auth/invite/accept" invalidCode="invite_invalid" noticeKind="invite_accepted"
        texts={{ title: t('invite.title'), subtitle: t('invite.subtitle', { email }), submit: t('invite.submit'), invalid: t('invite.invalid') }} />
    </LoginShell>
  )
}
