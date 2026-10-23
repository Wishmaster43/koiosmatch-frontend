/**
 * ResetPasswordPage — public page opened from the reset mail: set a new password.
 */
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import LoginShell from '@/components/auth/LoginShell'
import SetPasswordForm from './SetPasswordForm'

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  return (
    <LoginShell>
      <SetPasswordForm endpoint="/auth/password/reset" invalidCode="reset_token_invalid" noticeKind="password_reset" requestNewLink
        texts={{ title: t('reset.title'), subtitle: t('reset.subtitle', { email }), submit: t('reset.submit'), invalid: t('reset.invalid') }} />
    </LoginShell>
  )
}
