/**
 * ForgotPasswordPage — public page: request a password-reset link by e-mail.
 * The server answers 202 whether or not the address exists, so the page always
 * shows its OWN "sent" text and never branches on the server message.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGuardedSubmit } from '@/hooks/useGuardedSubmit'
import api, { primeCsrf } from '@/lib/api'
import { useRetryCountdown } from '@/hooks/useRetryCountdown'
import { retryAfterOf } from '@/lib/retryAfter'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import { PageTitle, BodyText, Caption } from '@/components/ui/typography'
import LoginShell from '@/components/auth/LoginShell'
import { AuthTextField } from '@/components/auth/AuthFields'

type Failure = 'invalid' | 'generic' | null

// Link back to the sign-in page, shared by the form and the sent state.
function BackLink({ label }: { label: string }) {
  return (
    <div style={{ marginTop: 24 }}>
      <Link to="/login">
        <Caption as="span" style={{ color: 'var(--color-primary-text)' }}>{label}</Caption>
      </Link>
    </div>
  )
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [failure, setFailure] = useState<Failure>(null)
  // Seconds until the request throttle lifts, counted down live.
  const countdown = useRetryCountdown()

  // Request the link: prime the CSRF cookie first (page may be opened cold), then POST.
  const run = async () => {
    setFailure(null)
    countdown.clear()
    try { await primeCsrf() } catch { /* a failed prime never blocks the attempt */ }
    try {
      await api.post('/auth/password/forgot', { email })
      setSent(true)
    } catch (err) {
      const secs = retryAfterOf(err)
      const status = (err as { response?: { status?: number } })?.response?.status
      if (secs !== null) countdown.start(secs)
      else if (status === 422) setFailure('invalid')
      else setFailure('generic')
    }
  }
  const { submit, saving } = useGuardedSubmit(run)
  const handleSubmit = (e: FormEvent) => { e.preventDefault(); void submit() }

  const throttled = countdown.active

  return (
    <LoginShell>
      <PageTitle as="h1" style={{ marginBottom: 4 }}>{t('forgot.title')}</PageTitle>
      {sent ? (
        <div style={{ marginTop: 24 }}>
          <CalloutBox variant="success" live="polite">{t('forgot.sent')}</CalloutBox>
        </div>
      ) : (
        <>
          <BodyText style={{ color: 'var(--text-muted)', marginBottom: 32 }}>{t('forgot.subtitle')}</BodyText>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AuthTextField id="forgot-email" label={t('login.email')} type="email" value={email} onChange={setEmail}
              placeholder={t('login.emailPlaceholder')} required autoFocus autoComplete="email" />

            {failure === 'invalid' && <ErrorBanner>{t('forgot.invalidEmail')}</ErrorBanner>}
            {failure === 'generic' && <ErrorBanner>{t('forgot.failed')}</ErrorBanner>}
            {throttled && (
              <CalloutBox variant="warning" live="polite">{t('forgot.throttled', { seconds: countdown.seconds })}</CalloutBox>
            )}

            <Button type="submit" variant="soft" size="md" disabled={saving || throttled} style={{ width: '100%' }}>
              {saving && <Spinner size={15} />}
              {saving ? t('forgot.busy') : t('forgot.submit')}
            </Button>
          </form>
        </>
      )}
      <BackLink label={t('forgot.backToLogin')} />
    </LoginShell>
  )
}
