import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ActionRuleBanner from '@/components/actionrules/ActionRuleBanner'
import { SectionTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'

/**
 * PhaseChangeAppointmentWarning — V-appdetail-2: the warn-not-block confirm for
 * moving an application onto a requires_appointment funnel phase while it has no
 * appointment planned yet (missingAppointment). Reuses the shared AXIS-MATRIX-2
 * `ActionRuleBanner` for its visual shape (§3A "one P-style banner"), fed a
 * LOCAL warn decision rather than a server preflight call — this is a client-
 * derived heuristic (funnel-lookup flag + the row's own missing-appointment
 * state), not a tenant action rule, so it never touches the actionrules API.
 * Confirming proceeds with the move exactly as an unintercepted move would;
 * cancelling drops it — the application never left its current phase either way.
 */
export default function PhaseChangeAppointmentWarning({ phaseLabel, onConfirm, onCancel }: {
  phaseLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation(['applications', 'common'])

  return (
    <FloatingPanel open onClose={onCancel} ariaLabel={t('moveWarn.title')} width={420} persistKey="application-move-warn"
      header={<SectionTitle as="span">{t('moveWarn.title')}</SectionTitle>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ActionRuleBanner decision={{ effect: 'warn', message: t('moveWarn.message', { phase: phaseLabel }) }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onCancel}>
            {t('moveWarn.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('moveWarn.confirm')}
          </Button>
        </div>
      </div>
    </FloatingPanel>
  )
}
