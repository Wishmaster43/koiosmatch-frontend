/**
 * ResolveClaimDialog — shared "mark as not sent" dialog for a stuck send-claim
 * (CLAIM-RESOLVE-1): one reason-gated confirm used by the match contract claim
 * (POST /matches/{id}/contract/resolve) and the admin invoice mail claim
 * (POST /admin/invoices/{id}/resolve-sending). The dialog owns only the FORM —
 * a required free-text reason, a danger confirm and an inline error — and never
 * knows the route: the caller's `onConfirm(reason)` does the actual POST and
 * throws on failure. A 409 from either route carries one of four known codes,
 * mapped here to its own copy; any other error falls back to extractApiError
 * (mirrors EraseWithPasswordDialog's error-mapping idiom).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { BodyText, Caption } from '@/components/ui/typography'
import { FieldRow, TextField } from '@/components/forms/fields'
import ReasonDialogFooter from './ReasonDialogFooter'
import { Z } from '@/lib/zIndexScale'
import { extractApiError } from '@/lib/extractApiError'

// The four known 409 codes both resolve routes answer — mapped to their own i18n'd text.
const KNOWN_CODES = ['contract_not_in_flight', 'contract_already_sent', 'invoice_already_sent', 'invoice_not_sending'] as const
type KnownCode = typeof KNOWN_CODES[number]

// Reads the server's `code` off a 409 and maps it, else falls back to extractApiError.
function errorMessage(err: unknown, t: (key: string) => string): string {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
  if (code && (KNOWN_CODES as readonly string[]).includes(code)) {
    return t(`common:resolveClaim.errors.${code as KnownCode}`)
  }
  return extractApiError(err, t('common:actionFailed'))
}

interface Props {
  open: boolean
  title: string
  intro: string
  confirmLabel: string
  // Throws to signal failure; the dialog reads the error, it never swallows it.
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
  // Stable per-surface persisted position (mirrors the house FloatingPanel convention).
  persistKey: string
}

// Reason-gated "mark as not sent" confirm: FloatingPanel shell + one required text field + danger confirm.
// The outer component only decides whether to mount — all stateful FORM body
// lives in the inner component below, so it is a FRESH mount (fresh reason/error
// state) every time the dialog opens, never state surviving a close/reopen on a
// DIFFERENT row (verifier fix: AdminInvoicesSettings mounts one dialog shared by
// every invoice row).
export default function ResolveClaimDialog({ open, title, intro, confirmLabel, onConfirm, onClose, persistKey }: Props) {
  if (!open) return null
  return (
    <ResolveClaimDialogBody title={title} intro={intro} confirmLabel={confirmLabel}
      onConfirm={onConfirm} onClose={onClose} persistKey={persistKey} />
  )
}

type BodyProps = Omit<Props, 'open'>

// The actual form: owns reason/submitting/error state, fresh per mount.
function ResolveClaimDialogBody({ title, intro, confirmLabel, onConfirm, onClose, persistKey }: BodyProps) {
  const { t } = useTranslation('common')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Submit: clears any previous error, lets the caller's own route run, and maps a
  // thrown failure onto one of the four known codes or extractApiError — never a silent close.
  const submit = async () => {
    const trimmed = reason.trim()
    if (!trimmed || submitting) return
    setSubmitting(true); setError(null)
    try {
      await onConfirm(trimmed)
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={title} title={title} width={440} zIndex={Z.confirm} persistKey={persistKey}
      bodyStyle={{ padding: 22 }}>
      <BodyText style={{ marginBottom: 14 }}>{intro}</BodyText>
      <FieldRow label={t('common:resolveClaim.reason')} required>
        {/* The backend caps the reason at 500 chars (CLAIM-RESOLVE-1); TextField
            carries no maxLength passthrough today, so length is server-enforced only. */}
        <TextField value={reason} aria-label={t('common:resolveClaim.reason')}
          onChange={setReason} onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      </FieldRow>
      <Caption as="p" style={{ marginTop: 6 }}>{t('common:resolveClaim.hint')}</Caption>
      <ReasonDialogFooter error={error} onCancel={onClose} onSubmit={submit} cancelLabel={t('common:cancel')}
        submitLabel={confirmLabel} disabled={!reason.trim()} busy={submitting} />
    </FloatingPanel>
  )
}
