/**
 * EraseWithPasswordDialog — shared password-confirmed erase dialog (CONTACT-ERASE-1-FE).
 * The dialog owns only the FORM: a password field, an Enter-to-submit confirm button and
 * an inline error. It never knows the route — the caller's `onConfirm(password)` does the
 * actual POST and throws on failure, and this file maps the thrown error onto one of two
 * i18n'd messages (wrong password / missing password) or the server's own extracted text.
 * Candidate erasure and the customer-wide trash flow can adopt this later (brief §1).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ModalFooter from '@/components/ui/ModalFooter'
import { BodyText, Caption, captionStyle } from '@/components/ui/typography'
import { FieldRow, TextField } from '@/components/forms/fields'
import { extractApiError } from '@/lib/extractApiError'

// The two HTTP statuses this dialog maps to its own copy; anything else falls
// back to the server's own message via extractApiError.
function errorMessage(err: unknown, t: (key: string) => string): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return t('common:eraseDialog.wrongPassword')
  if (status === 422) return t('common:eraseDialog.passwordRequired')
  return extractApiError(err, t('common:actionFailed'))
}

// Password-confirmed erase dialog: FloatingPanel shell + one password field + danger confirm.
export default function EraseWithPasswordDialog({ open, title, intro, confirmLabel, onConfirm, onClose, busy: busyProp }: {
  open: boolean
  title: string
  intro: string
  confirmLabel: string
  // Throws to signal failure; the dialog reads the error, it never swallows it.
  onConfirm: (password: string) => Promise<void>
  onClose: () => void
  // Optional caller-driven busy flag (e.g. a parent-level in-flight refresh) layered onto the dialog's own.
  busy?: boolean
}) {
  const { t } = useTranslation('common')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = submitting || Boolean(busyProp)

  if (!open) return null

  // Submit: clears any previous error, lets the caller's own route run, and maps a
  // thrown failure onto the right copy — never a silent close on error.
  const submit = async () => {
    if (!password || busy) return
    setSubmitting(true); setError(null)
    try {
      await onConfirm(password)
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={title} title={title} width={440} bodyStyle={{ padding: 22 }}>
      <BodyText style={{ marginBottom: 14 }}>{intro}</BodyText>
      <FieldRow label={t('common:eraseDialog.password')} required>
        <TextField type="password" autoComplete="current-password" value={password}
          onChange={setPassword} onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      </FieldRow>
      <Caption as="p" style={{ marginTop: 6 }}>{t('common:eraseDialog.hint')}</Caption>
      {/* A raw <p> (not the Caption atom) — TypoProps carries no `role`, and this
          line must be announced as an alert (§6). */}
      {error && <p role="alert" style={{ ...captionStyle, marginTop: 8, color: 'var(--color-danger-text)' }}>{error}</p>}
      <div style={{ marginTop: 18 }}>
        <ModalFooter onCancel={onClose} onSubmit={submit} cancelLabel={t('common:cancel')}
          submitLabel={confirmLabel} disabled={!password} busy={busy} danger />
      </div>
    </FloatingPanel>
  )
}
