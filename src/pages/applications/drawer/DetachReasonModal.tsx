import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Unlink } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import DictationTextarea from '@/components/forms/DictationTextarea'
import { PageTitle, Caption } from '@/components/ui/typography'

const REASON_MAX = 1000

interface Props {
  onCancel: () => void
  onConfirm: (reason: string) => void
  submitting?: boolean
}

/**
 * DetachReasonModal — S15: the backend now REQUIRES a reason to detach an
 * application (`DELETE /applications/{id}` 422s without one) and stores it as a
 * timeline/notes trail entry, so this is a small, honest confirm step rather
 * than a silent action. The reason is a plain string (BE validates
 * `string|max:1000`, not rich content) — a RichTextEditor would be overkill for
 * a short structured "why", mirroring other reason prompts in this app.
 */
export default function DetachReasonModal({ onCancel, onConfirm, submitting }: Props) {
  const { t } = useTranslation(['applications', 'common'])
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  return (
    // POPUP-SLEEP-1: shell swapped onto the shared FloatingPanel (draggable/
    // resizable, remembered position) — body/footer and flows unchanged.
    <FloatingPanel open onClose={onCancel} ariaLabel={t('detach.reasonTitle')}
      persistKey="application-detach-reason" width={420} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }}><Unlink size={16} /></span>
          <PageTitle as="span" style={{ fontWeight: 700 }}>{t('detach.reasonTitle')}</PageTitle>
        </span>
      }>
        <Caption as="label" style={{ display: 'block', marginBottom: 5 }}>{t('detach.reasonLabel')}</Caption>
        {/* POP-UPS 4: de reden krijgt de house-mic (plain-text dictatie). */}
        <DictationTextarea autoFocus value={reason} rows={3} aria-label={t('detach.reasonLabel')}
          onChange={v => setReason(v.slice(0, REASON_MAX))} placeholder={t('detach.reasonPlaceholder')} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Button variant="secondary" onClick={onCancel}>
            {t('common:cancel')}
          </Button>
          <Button variant="danger" onClick={() => trimmed && onConfirm(trimmed)} disabled={!trimmed || submitting}>
            {t('detach.confirm')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
