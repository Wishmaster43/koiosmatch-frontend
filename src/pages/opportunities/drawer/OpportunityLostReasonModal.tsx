/**
 * OpportunityLostReasonModal — OPP-LOST-FE-1: the confirm popup that gates a
 * stage move to an is_lost stage (mirrors applications/drawer/RejectionModal.tsx,
 * trimmed to reason-only — no AI advice block, no note editor, since the
 * backend contract carries only `lost_reason`).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { Caption, PageTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { useOpportunityLostReasons } from '@/lib/useOpportunityLostReasons'

interface Props {
  onCancel: () => void
  onConfirm: (reason: string) => void
  submitting?: boolean
}

// The reason picker + confirm/cancel footer (see the module doc above).
export default function OpportunityLostReasonModal({ onCancel, onConfirm, submitting }: Props) {
  const { t } = useTranslation(['opportunities', 'common'])
  const { reasons } = useOpportunityLostReasons()
  const [reason, setReason] = useState('')

  // Confirms the lost move with the picked reason; a no-op without one or while already submitting.
  const submit = () => { if (!reason || submitting) return; onConfirm(reason) }

  return (
    <FloatingPanel open onClose={onCancel} ariaLabel={t('lost.modalTitle')}
      persistKey="opportunity-lost-reason" width={480} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }}><XCircle size={16} /></span>
          <PageTitle as="span">{t('lost.modalTitle')}</PageTitle>
        </span>
      }>
      <div>
        {/* Reason — searchable CreatableSelect, allowCreate off: a lost reason is a
            tenant lookup, picked never free-typed here (mirrors RejectionModal). */}
        <Caption as="div" style={{ marginBottom: 5 }}>{t('lost.reason')}</Caption>
        <CreatableSelect allowCreate={false} value={reason || null} onChange={setReason}
          placeholder={t('lost.reasonPlaceholder')}
          options={reasons.map(r => ({ value: r.value, label: r.label }))} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="secondary" onClick={onCancel}>{t('common:cancel')}</Button>
        <Button variant="danger" onClick={submit} disabled={!reason || submitting}>
          {t('lost.confirm')}
        </Button>
      </div>
    </FloatingPanel>
  )
}
