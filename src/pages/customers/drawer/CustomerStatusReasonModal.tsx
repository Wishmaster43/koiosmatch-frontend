/**
 * CustomerStatusReasonModal — the blacklist-reason prompt raised when a customer
 * status change picks a status flagged `is_blacklist` (KLANT-BLACKLIST-PROMPT-1,
 * Danny 04-09: "Blacklist ja" — the candidate flow's same prompt, mirrored here).
 * Mirrors CandidateStatusModals' StatusReasonModal: FloatingPanel shell, a
 * lookup-backed searchable dropdown (never free text, the backend validates
 * against customer_blacklist_reasons.name), Save gated by the tenant's
 * `customer_blacklist_reason_required` switch. Presentational: the parent
 * (useCustomerDrawerActions) owns the modal state and the confirm handler.
 */
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { Z } from '@/lib/zIndexScale'
import { useId } from 'react'
import { Caption, FormLabel } from '@/components/ui/typography'
import Button from '@/components/ui/Button'

// KEY-ADOPTION: each option carries its stable backend key (null for fallbacks).
export interface BlacklistReasonOption { value: string; label: string; key?: string | null }

// KEY-ADOPTION: track the picked reason's stable key alongside the name.
export interface CustomerBlacklistModalState { target: string; reason: string; reasonKey: string | null; needReason: boolean }

interface Props {
  state: CustomerBlacklistModalState
  onChangeReason: (reason: string) => void
  onCancel: () => void
  onConfirm: () => void
  reasons: BlacklistReasonOption[]
  // BLACKLIST-EMPTY-1: true once the lookup answered; an empty answer is a real 'none configured'.
  reasonsLoaded?: boolean
}

// The single overlay: a searchable, lookup-backed reason picker + cancel/save footer.
export default function CustomerStatusReasonModal({ state, onChangeReason, onCancel, onConfirm, reasons, reasonsLoaded = true }: Props) {
  const { t } = useTranslation('customers')
  // The picker renders a button, which htmlFor cannot label: the label id travels via aria-labelledby.
  const labelId = useId()
  return (
    // POPUP-SLEEP-1 shell (mirrors the candidate modal): draggable, remembered position.
    <FloatingPanel open onClose={onCancel} title={t('drawer.blacklistReasonTitle')} ariaLabel={t('drawer.blacklistReasonTitle')}
      persistKey="customer-status-reason" width={400} zIndex={Z.confirm} bodyStyle={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <FormLabel as="div" id={labelId} style={{ marginBottom: 5 }}>{t('drawer.blacklistReasonLabel')}</FormLabel>
        {/* Lookup-backed searchable dropdown (BE validates exists on customer_blacklist_reasons.name). */}
        <CreatableSelect value={state.reason || null} allowCreate={false} clearable aria-labelledby={labelId}
          onChange={v => onChangeReason(v || '')}
          placeholder={t('drawer.blacklistReasonPick')} options={reasons}
          style={{ padding: '8px 10px', fontSize: 12 }} />
        {/* BLACKLIST-EMPTY-1: a required reason with NO configured reasons is a dead end:
            say so and point at the settings screen instead of an empty required picker. */}
        {reasonsLoaded && reasons.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <Caption as="span">{t('drawer.blacklistReasonNone')}</Caption>
            <Button variant="ghost" size="sm" href="#settings/customers/customer_blacklist_reasons">{t('drawer.blacklistReasonSetup')}</Button>
          </div>
        )}
        {/* The tenant switch can make the reason optional; say so explicitly rather than leaving Save unexplained. */}
        {!state.needReason && (
          <Caption as="div" style={{ marginTop: 4, fontStyle: 'italic' }}>{t('drawer.blacklistReasonOptionalHint')}</Caption>
        )}
      </div>
      {/* Deliberately the candidate StatusReasonModal's own footer row (1:1 mirror of the face
          Danny knows), not ModalFooter; both prompts change together or not at all. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={onCancel}>{t('common:cancel')}</Button>
        <Button variant="primary" size="sm" onClick={onConfirm} disabled={state.needReason && !state.reason.trim()}>{t('common:save')}</Button>
      </div>
    </FloatingPanel>
  )
}
