import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'

// AXIS-MATRIX-2 audit R1 (CMFE 2026-07-17) → fake-affordance sweep (14-08): this
// tab used to render a whole screen of roles/pools/shift-type/licence pickers, all
// permanently disabled because no PATCH/PUT endpoint writes
// `candidate_planning_settings` anywhere in the backend (only a read-side resource
// exists). A page full of dead, greyed-out controls is a worse signal than a plain
// notice — so this replaces every dead field with ONE calm message. Restore the
// real editor (git history has it) the moment the planning module ships a save path.

/** Planning tab — the planning module does not exist yet, so this is a single honest notice instead of a screen of disabled controls. */
// No props while this is a notice: the candidate carried no meaning here. The
// real editor (git history) takes its candidate back when the module ships.
export default function PlanningTab() {
  const { t } = useTranslation('candidates')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: '48px 24px', textAlign: 'center' }}>
      <CalendarClock size={28} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{t('planning.moduleNotAvailableTitle')}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, maxWidth: 360 }}>{t('planning.moduleNotAvailableBody')}</p>
    </div>
  )
}
