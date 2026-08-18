/**
 * ActionRuleDialog — modal variant of the shared preflight banner, for regular
 * (non-Koios) pages that want a blocking P-popup before a guarded action (§3A).
 * Deliberately thin: the banner above (ActionRuleBanner) is the actual content;
 * this only adds the modal chrome (overlay, focus trap, Escape-to-close) + the
 * confirm/cancel footer. `block` decisions hide the confirm button — there is
 * nothing to proceed with.
 */
import { useTranslation } from 'react-i18next'
import ActionRuleBanner from './ActionRuleBanner'
import FloatingPanel from '@/components/ui/FloatingPanel'
import type { ActionRuleDecision } from './actionRuleTypes'
import Button from '@/components/ui/Button'

export interface ActionRuleDialogProps {
  open: boolean
  decision: ActionRuleDecision | null | undefined
  onConfirm: () => void
  onCancel: () => void
}

// POPUP-SLEEP (Danny punt 19): the hand-rolled overlay/focus-trap is replaced by the
// shared FloatingPanel, so this P-popup can be dragged aside (by its header) to read
// the record it is warning about — while keeping the exact same Escape/focus semantics.
export default function ActionRuleDialog({ open, decision, onConfirm, onCancel }: ActionRuleDialogProps) {
  const { t } = useTranslation('common')
  const canConfirm = decision?.effect !== 'block'

  return (
    <FloatingPanel open={open} onClose={onCancel} ariaLabel={t('actionRules.title')}
      width={380} maxWidth="90vw" persistKey="action-rule" bodyStyle={{ padding: 16 }}
      header={<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('actionRules.title')}</span>}>
      <ActionRuleBanner decision={decision} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {t('actionRules.cancel')}
        </Button>
        {canConfirm && (
          <Button variant="primary" size="sm" onClick={onConfirm}>
            {t('actionRules.ok')}
          </Button>
        )}
      </div>
    </FloatingPanel>
  )
}
