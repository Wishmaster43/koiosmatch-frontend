/**
 * DetachApplicationModal — the confirm step for "ontkoppel deze sollicitatie"
 * from the candidate drawer (Danny punt 7, 08-08).
 *
 * WHY NOT the shared ConfirmDialog: measured live against the API on 08-08 —
 * `DELETE /applications/{id}` with no body answers **422 {"message":"The reason
 * field is required."}**, and with `{"reason":"…"}` answers **204**
 * (ApplicationController::destroy validates `reason: required|string|max:1000`
 * and stores it as an application note). A yes/no dialog cannot carry that
 * reason, so it would ship a guaranteed-422 button — the exact "bulk-ontkoppelen
 * was volledig dood terwijl de unit-test groen was" lesson (§13). This prompt is
 * therefore a reason-collecting confirm, in the same shape the candidate drawer
 * already uses for its own status-reason prompt (FloatingPanel + plain textarea +
 * cancel/confirm), with the danger tint on the confirm button.
 *
 * The reason is a plain string (BE validates `string|max:1000`, not rich
 * content) — the same documented deviation from the rich-text rule as
 * StatusReasonModal: it is never rendered as HTML, only stored as note text.
 *
 * FORMER KNOWN DUPLICATION, now resolved (DRY round 10, MODALS): `pages/applications/
 * drawer/DetachReasonModal.tsx` is the same prompt for the applications page — both
 * files now share their Cancel/Confirm row via `components/forms/ReasonPromptFooter`.
 * The header (icon badge + title) stays hand-rolled HERE on purpose: it carries an
 * `aria-hidden="true"` on the icon badge that the shared `ReasonModalHeader` atom
 * (used by DetachReasonModal) does not, and this file is part of the frozen
 * candidate drawer (§14 SCHERMWAARHEID-1) — its DOM/aria must stay byte-identical.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Unlink } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { Z } from '@/lib/zIndexScale'
import DictationTextarea from '@/components/forms/DictationTextarea'
import ReasonPromptFooter from '@/components/forms/ReasonPromptFooter'
import { PageTitle, BodyText, Caption } from '@/components/ui/typography'

// Mirrors the backend limit (ApplicationController::destroy — string|max:1000).
const REASON_MAX = 1000

export default function DetachApplicationModal({ label, onCancel, onConfirm, submitting }: {
  // The row's own vacancy label — names WHAT is being detached in the message.
  label: string
  onCancel: () => void
  onConfirm: (reason: string) => void
  submitting?: boolean
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const disabled = !trimmed || Boolean(submitting)

  return (
    // Same shared chrome as the sibling candidate prompts — draggable, focus-trapped,
    // above the drawer via Z.confirm.
    <FloatingPanel open onClose={onCancel} ariaLabel={t('work.detachTitle')}
      persistKey="candidate-detach-application" width={420} maxWidth="92vw" zIndex={Z.confirm}
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }} aria-hidden="true"><Unlink size={16} /></span>
          <PageTitle as="span" style={{ fontWeight: 700 }}>{t('work.detachTitle')}</PageTitle>
        </span>
      }>
        {/* Honest explanation: detaching is a reversible soft-delete, and the reason lands in the timeline. */}
        <BodyText as="div" style={{ marginBottom: 12 }}>
          {t('work.detachMessage', { name: label })}
        </BodyText>
        <Caption as="label" htmlFor="detach-application-reason" style={{ display: 'block', marginBottom: 5 }}>
          {t('work.detachReasonLabel')}</Caption>
        {/* POP-UPS 4: de reden krijgt de house-mic (plain-text dictatie). */}
        <DictationTextarea id="detach-application-reason" autoFocus value={reason} rows={3}
          onChange={v => setReason(v.slice(0, REASON_MAX))} placeholder={t('work.detachReasonPlaceholder')} />

        <ReasonPromptFooter onCancel={onCancel} cancelLabel={t('common:cancel')}
          onConfirmClick={() => trimmed && onConfirm(trimmed)} confirmDisabled={disabled}
          confirmContent={submitting ? t('common:saving') : t('work.detachConfirm')} />
    </FloatingPanel>
  )
}
