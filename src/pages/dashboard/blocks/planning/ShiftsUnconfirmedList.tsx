/**
 * ShiftsUnconfirmedList — planning work-feed tile: shifts still awaiting
 * candidate confirmation, routing to that candidate's communication tab.
 */
import { useTranslation } from 'react-i18next'
import WidgetListBlock from '@/pages/dashboard/blocks/WidgetListBlock'
import { useDateFormat } from '@/lib/datetime'
import type { ShiftUnconfirmedRow } from '@/types/dashboard'

export default function ShiftsUnconfirmedList({ rows, onNavigate }: {
  rows: ShiftUnconfirmedRow[]
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()
  const goToPlanning = () => onNavigate?.('planning')

  // Each row deep-links to the candidate's communication tab.
  const widgetRows = rows.map(r => ({
    key: r.schedule_id,
    primary: r.candidate || t('widget.unknown'),
    secondary: r.order_title ?? undefined,
    meta: r.shift_start
      ? formatDate(r.shift_start, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—',
    onClick: onNavigate ? () => onNavigate('candidates', { open: r.candidate_id, tab: 'communication' }) : undefined,
  }))

  return (
    <WidgetListBlock title={t('block.shiftsUnconfirmedList')} action={t('feed.openPlanning')} onAction={goToPlanning} rows={widgetRows} />
  )
}
