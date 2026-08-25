/**
 * AppointmentsNext48hList — recruitment work-feed tile: appointments scheduled
 * in the next 48 hours (dash.appointments_next_48h). The appointment type is
 * resolved through the tenant's own useAppointmentTypes() lookup, never the raw
 * slug. Rows render via the shared WidgetListBlock (§3A: reuse, not re-invention).
 */
import { useTranslation } from 'react-i18next'
import WidgetListBlock from '../WidgetListBlock'
import { useDateFormat } from '@/lib/datetime'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { AppointmentNext48hRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function AppointmentsNext48hList({ rows, onNavigate }: {
  rows: AppointmentNext48hRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()
  const { metaOf } = useAppointmentTypes()
  // LOOKUP-I18N-1: the seeded appointment-type label renders in the user's language.
  const seedLabel = useSeedLabel()

  // Map the server rows to the shared list row shape, resolving the type
  // slug to its tenant label and picking the application or candidate target.
  const listRows = rows.map(r => {
    const meta = metaOf(r.type)
    return {
      key: r.appointment_id,
      primary: r.candidate?.name || t('widget.unknown'),
      secondary: meta?.label ? seedLabel('appointmentTypes', { value: r.type, label: meta.label }) : undefined,
      meta: formatDate(r.scheduled_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      // No onNavigate → a plain row (no role/cursor), never a dead click.
      onClick: onNavigate ? () => (r.application_id
        ? onNavigate('applications', { open: r.application_id })
        : onNavigate('candidates', { open: r.candidate_id })) : undefined,
    }
  })

  return <WidgetListBlock title={t('block.appointmentsNext48h')} rows={listRows} />
}
