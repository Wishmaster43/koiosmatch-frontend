/**
 * useUserMfaReset — reset a colleague's MFA enrollment; they re-enroll at next login.
 * Mirrors the shape of useUserDeletion: a confirm dialog → API call → notify.
 * Requires permission users.mfa_reset and cannot reset yourself.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resetUserMfa } from '@/lib/mfaApi'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useConfirm } from '@/hooks/useConfirm'
import type { ManagedUser } from '@/types/api'

// Two-step MFA reset: confirm dialog → API call → toast. The list needs no reload:
// a row carries no MFA state, the colleague simply re-enrolls at their next login.
export function useUserMfaReset() {
  const { t } = useTranslation('users')
  const { confirm, dialog } = useConfirm()
  const [busy, setBusy] = useState(false)

  // Confirm and reset a user's MFA enrollment.
  const requestReset = (user: ManagedUser) => {
    const userName = user.name ?? user.email ?? ''
    confirm(
      t('resetMfaConfirm', { name: userName }),
      async () => {
        setBusy(true)
        try {
          if (user.id == null) return
          await resetUserMfa(user.id)
          notifySuccess(t('resetMfaDone', { name: userName }))
        } catch (err) {
          notifyError(extractApiError(err, t('common:actionFailed')))
        } finally {
          setBusy(false)
        }
      },
      { danger: true }
    )
  }

  return { dialog, busy, requestReset }
}
