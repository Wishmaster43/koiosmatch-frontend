import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ActionRuleBanner from '@/components/actionrules/ActionRuleBanner'
import { BTN_H } from '@/config/buttonMetrics'

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
      header={<span style={{ fontSize: 13, fontWeight: 600 }}>{t('moveWarn.title')}</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ActionRuleBanner decision={{ effect: 'warn', message: t('moveWarn.message', { phase: phaseLabel }) }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel}
            style={{ height: BTN_H, padding: '0 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
            {t('moveWarn.cancel')}
          </button>
          <button type="button" onClick={onConfirm}
            style={{ height: BTN_H, padding: '0 14px', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)', background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', color: 'var(--color-warning)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {t('moveWarn.confirm')}
          </button>
        </div>
      </div>
    </FloatingPanel>
  )
}
