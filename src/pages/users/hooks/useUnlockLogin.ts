/**
 * useUnlockLogin — admin action that clears a login lockout (C-004): POST
 * /users/{id}/unlock-login, then a toast and the row update after success.
 * Errors map by code/status, never the raw server message.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { apiErrorKey } from '@/lib/extractApiError'
import { notifyError, notifySuccess } from '@/lib/notify'
import { userDisplayName } from '../userRow'
import type { UserRow } from '../userRow'

// Returns a stable unlock handler; `onUnlocked` receives the row with the lock cleared.
export function useUnlockLogin(onUnlocked: (user: UserRow) => void) {
  const { t } = useTranslation('users')

  return useCallback(async (user: UserRow) => {
    try {
      await api.post(`/users/${user.id}/unlock-login`)
      notifySuccess(t('lockout.unlocked', { name: userDisplayName(user) }))
      onUnlocked({ ...user, login_locked_until: null })
    } catch (err) {
      // Same idiom as the invite resend: code-mapped key, 429 gets its own text.
      const status = (err as { response?: { status?: number } })?.response?.status
      const key = apiErrorKey(err)
      notifyError(key ? t(key, { ns: 'common' }) : status === 429 ? t('lockout.unlockThrottled') : t('lockout.unlockFailed'))
    }
  }, [t, onUnlocked])
}
