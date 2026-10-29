/**
 * SetPasswordForm — shared body of the public reset-password and accept-invite pages:
 * reads token + email from the mail link, collects a new password and posts it back.
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGuardedSubmit } from '@/hooks/useGuardedSubmit'
import { useAuthRequest } from '@/hooks/useAuthRequest'
import api from '@/lib/api'
import { safeEmailParam } from '@/lib/safeEmailParam'
import { retryAfterOf } from '@/lib/retryAfter'
import { setAuthNotice } from '@/lib/authNotice'
import { useAuth } from '@/context/AuthContext'
import { useNumberFormat } from '@/lib/formatters'
import FieldNotice from '@/components/ui/FieldNotice'
import type { AuthNoticeKind } from '@/lib/authNotice'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import { PageTitle, BodyText, Caption } from '@/components/ui/typography'
import { AuthLink, BackLink } from '@/components/auth/AuthLink'
import { AuthPasswordField } from '@/components/auth/AuthFields'

// Minimum password length; the backend enforces the same 8 (the copy interpolates this value, never a literal).
const MIN_LENGTH = 8

export interface SetPasswordTexts {
  title: string
  subtitle: string // already interpolated by the page (e.g. with the address)
  submit: string
  invalid: string
}

interface Props {
  endpoint: string
  invalidCode: string
  noticeKind: AuthNoticeKind
  texts: SetPasswordTexts
  requestNewLink?: boolean
}

type Failure = 'weak' | 'generic' | null

export default function SetPasswordForm({ endpoint, invalidCode, noticeKind, texts, requestNewLink }: Props) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const auth = useAuth()
  const { formatNumber } = useNumberFormat()
  const [params, setParams] = useSearchParams()
  // Capture the single-use token + address once, so they survive the URL strip below.
  const [token] = useState(() => params.get('token') ?? '')
  const [email] = useState(() => safeEmailParam(params.get('email')))
  // Remove token and address from the address bar and history as soon as they are captured.
  useEffect(() => {
    if (params.has('token') || params.has('email')) setParams({}, { replace: true })
  }, [params, setParams])
  const [done, setDone] = useState(false)
  // The page interpolates the address into the subtitle from the live URL; keep that first render's text once the URL is stripped.
  const [subtitle] = useState(texts.subtitle)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [linkDead, setLinkDead] = useState(false)
  const [failure, setFailure] = useState<Failure>(null)
  // Seconds until the throttle lifts, counted down live.
  const { countdown, begin } = useAuthRequest()

  // Post the new password: prime CSRF first (page opens cold from a mail), then map every outcome.
  const run = async () => {
    setFailure(null)
    await begin()
    try {
      await api.post(endpoint, { email, token, password, password_confirmation: confirm })
      // A signed-in visitor would bounce off the public /login route, so show the result here instead.
      if (auth?.user) { setDone(true); return }
      setAuthNotice(noticeKind)
      navigate('/login', { replace: true })
    } catch (err) {
      const secs = retryAfterOf(err)
      const res = (err as { response?: { status?: number; data?: { code?: string; errors?: { password?: unknown; email?: unknown; token?: unknown } } } })?.response
      if (secs !== null) countdown.start(secs)
      else if (res?.status === 422 && res.data?.code === invalidCode) setLinkDead(true)
      else if (res?.status === 422 && (res.data?.errors?.email || res.data?.errors?.token)) setLinkDead(true)
      else if (res?.status === 422 && res.data?.errors?.password) setFailure('weak')
      else setFailure('generic')
    }
  }
  const { submit, saving } = useGuardedSubmit(run)
  const handleSubmit = (e: FormEvent) => { e.preventDefault(); void submit() }

  // Signed-in visitor: the success message is shown in place, with a way back to the app.
  if (done) {
    return (
      <>
        <PageTitle as="h1" style={{ marginBottom: 4 }}>{texts.title}</PageTitle>
        <div style={{ marginTop: 24 }}>
          <CalloutBox variant="success" live="polite">{t('setPassword.doneSignedIn')}</CalloutBox>
        </div>
        <div style={{ marginTop: 16 }}>
          <AuthLink to="/" label={t('setPassword.toApp')} />
        </div>
      </>
    )
  }

  // A link without token or address (or one the server rejected) offers no form at all.
  if (!token || !email || linkDead) {
    return (
      <>
        <PageTitle as="h1" style={{ marginBottom: 4 }}>{texts.title}</PageTitle>
        <div style={{ marginTop: 24 }}>
          <CalloutBox variant="danger" live="polite">{texts.invalid}</CalloutBox>
        </div>
        {requestNewLink && (
          <div style={{ marginTop: 16 }}>
            <AuthLink to="/forgot-password" label={t('reset.requestNew')} />
          </div>
        )}
        <BackLink label={t('forgot.backToLogin')} />
      </>
    )
  }

  const mismatch = confirm.length > 0 && password !== confirm
  const valid = password.length >= MIN_LENGTH && password === confirm
  const throttled = countdown.active

  return (
    <>
      <PageTitle as="h1" style={{ marginBottom: 4 }}>{texts.title}</PageTitle>
      <BodyText style={{ color: 'var(--text-muted)', marginBottom: 32 }}>{subtitle}</BodyText>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <AuthPasswordField id="set-password" label={t('setPassword.password')} value={password} onChange={setPassword}
            required autoComplete="new-password" showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')} />
          <Caption style={{ display: 'block', marginTop: 4 }}>{t('setPassword.minHint', { min: formatNumber(MIN_LENGTH) })}</Caption>
        </div>
        <div onBlur={() => setTouched(true)}>
          <AuthPasswordField id="set-password-confirm" label={t('setPassword.confirm')} value={confirm} onChange={setConfirm}
            required autoComplete="new-password" showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')} />
          <FieldNotice text={touched && mismatch ? t('setPassword.mismatch') : null} style={{ marginTop: 4 }} />
        </div>

        {failure === 'weak' && <ErrorBanner>{t('setPassword.weak', { min: formatNumber(MIN_LENGTH) })}</ErrorBanner>}
        {failure === 'generic' && <ErrorBanner>{t('setPassword.failed')}</ErrorBanner>}
        {throttled && <CalloutBox variant="warning" live="polite">{t('setPassword.throttled', { seconds: countdown.seconds })}</CalloutBox>}

        <Button type="submit" variant="soft" size="md" disabled={saving || throttled || !valid} style={{ width: '100%' }}>
          {saving && <Spinner size={15} />}
          {texts.submit}
        </Button>
      </form>
      <BackLink label={t('forgot.backToLogin')} />
    </>
  )
}
