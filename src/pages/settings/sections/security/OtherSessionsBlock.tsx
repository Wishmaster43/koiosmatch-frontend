/**
 * OtherSessionsBlock — profile security action that ends every other browser
 * session of the current user (C-005); this session stays signed in.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { notifySuccess, notifyError } from '@/lib/notify'
import { apiErrorKey } from '@/lib/extractApiError'

// Posts the logout-others request; the 2xx body is deliberately never read, 429 means throttled.
export default function OtherSessionsBlock() {
  const { t } = useTranslation('settings')
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    setBusy(true)
    try {
      await api.post('/auth/sessions/logout-others')
      notifySuccess(t('security.otherSessionsDone'))
    } catch (err) {
      // Invite-resend idiom: a coded refusal renders its common copy, 429 is throttled, anything else our own fallback (never the server sentence).
      const status = (err as { response?: { status?: number } })?.response?.status
      const key = apiErrorKey(err)
      notifyError(key ? t(key, { ns: 'common' }) : status === 429 ? t('security.otherSessionsThrottled') : t('security.otherSessionsFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 14,
                  display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SectionTitle>{t('security.otherSessionsTitle')}</SectionTitle>
        <Caption style={{ display: 'block', marginTop: 2 }}>{t('security.otherSessionsDesc')}</Caption>
      </div>
      <Button variant="secondary" onClick={handleClick} disabled={busy} style={{ flexShrink: 0 }}>
        {busy ? t('security.working') : t('security.otherSessionsButton')}
      </Button>
    </div>
  )
}
