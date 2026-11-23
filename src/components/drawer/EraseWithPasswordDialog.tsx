/**
 * EraseWithPasswordDialog — shared password-confirmed erase dialog (CONTACT-ERASE-1-FE).
 * The dialog owns only the FORM: a password field, an Enter-to-submit confirm button and
 * an inline error. It never knows the route — the caller's `onConfirm(password)` does the
 * actual POST and throws on failure, and this file maps the thrown error onto one of two
 * i18n'd messages (wrong password / missing password) or the server's own extracted text.
 * Adopted by the contact person (K-005), the Shiftmanager employee (H-003) and the candidate
 * (CANDIDATE-ERASE-FE-1).
 * CANDIDATE-ERASE-FE-1 / ERASURE-OPEN-MATCH-1: the optional `conflict` step. When onConfirm throws an
 * error the caller recognises as a resolvable refusal (a 409 candidate_has_open_match), the dialog
 * shows that sentence in a warning callout with ONE explicit action that re-runs onConfirm with
 * `{ resolveConflict: true }`. The plain confirm and Enter stay inert until the password changes, so
 * the escalation is always a deliberate click, never a repeated Enter on the same field.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import { BodyText, Caption } from '@/components/ui/typography'
import { FieldRow, TextField } from '@/components/forms/fields'
import ReasonDialogFooter from './ReasonDialogFooter'
import { extractApiError } from '@/lib/extractApiError'

// A refusal the caller can escalate past: `detect` returns the translated sentence for it (null for any
// other error) and `actionLabel` names the escalation button.
export interface EraseConflict {
  detect: (err: unknown) => string | null
  actionLabel: string
}

// The two HTTP statuses this dialog maps to its own copy; anything else falls
// back to the server's own message via extractApiError.
function errorMessage(err: unknown, t: (key: string) => string): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return t('common:eraseDialog.wrongPassword')
  if (status === 422) return t('common:eraseDialog.passwordRequired')
  return extractApiError(err, t('common:actionFailed'))
}

// Password-confirmed erase dialog: FloatingPanel shell + one password field + danger confirm.
export default function EraseWithPasswordDialog({ open, title, intro, confirmLabel, onConfirm, onClose, busy: busyProp, conflict }: {
  open: boolean
  title: string
  intro: string
  confirmLabel: string
  // Throws to signal failure; the dialog reads the error, it never swallows it. The options argument is
  // present ONLY on the escalation click (callers without a conflict step keep the one-argument call).
  onConfirm: (password: string, opts?: { resolveConflict: boolean }) => Promise<void>
  onClose: () => void
  // Optional caller-driven busy flag (e.g. a parent-level in-flight refresh) layered onto the dialog's own.
  busy?: boolean
  // Optional resolvable-refusal step (see the file doc).
  conflict?: EraseConflict
}) {
  const { t } = useTranslation('common')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const busy = submitting || Boolean(busyProp)
  // Button forwards a button-or-anchor ref; both elements expose focus().
  const conflictActionRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null)

  // The footer confirm the user just clicked turns disabled when a conflict appears, so focus would fall
  // to the body: move it to the escalation button, the only way forward, and keep keyboard users in place.
  useEffect(() => {
    if (conflictMessage) conflictActionRef.current?.focus()
  }, [conflictMessage])

  if (!open) return null

  // Submit: clears any previous error, lets the caller's own route run, and maps a
  // thrown failure onto the right copy (or the conflict step): never a silent close on error.
  // The plain path is inert while a conflict stands: only the callout's action resolves it.
  const submit = async (resolveConflict = false) => {
    if (!password || busy) return
    if (!resolveConflict && conflictMessage) return
    setSubmitting(true); setError(null)
    try {
      await (resolveConflict ? onConfirm(password, { resolveConflict: true }) : onConfirm(password))
    } catch (err) {
      const resolvable = conflict?.detect(err) ?? null
      if (resolvable) setConflictMessage(resolvable)
      else setError(errorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  // A changed password restarts the plain flow: the conflict belongs to the attempt that raised it.
  const changePassword = (value: string) => {
    setPassword(value)
    if (conflictMessage) setConflictMessage(null)
  }

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={title} title={title} width={440} bodyStyle={{ padding: 22 }}>
      <BodyText style={{ marginBottom: 14 }}>{intro}</BodyText>
      <FieldRow label={t('common:eraseDialog.password')} required>
        <TextField type="password" autoComplete="current-password" value={password}
          onChange={changePassword} onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      </FieldRow>
      <Caption as="p" style={{ marginTop: 6 }}>{t('common:eraseDialog.hint')}</Caption>
      {conflictMessage && conflict && (
        <div style={{ marginTop: 12 }}>
          <CalloutBox variant="warning">
            {conflictMessage}
            <div style={{ marginTop: 10 }}>
              <Button ref={conflictActionRef} variant="danger" size="sm" disabled={busy} onClick={() => submit(true)}>{conflict.actionLabel}</Button>
            </div>
          </CalloutBox>
        </div>
      )}
      <ReasonDialogFooter error={error} onCancel={onClose} onSubmit={() => submit()} cancelLabel={t('common:cancel')}
        submitLabel={confirmLabel} disabled={!password || Boolean(conflictMessage)} busy={busy} />
    </FloatingPanel>
  )
}
