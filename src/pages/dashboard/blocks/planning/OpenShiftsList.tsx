/**
 * OpenShiftsList — planning work-feed tile: open shifts still needing a
 * candidate, rendered through the shared WidgetListBlock row idiom. No shift
 * drilldown intent exists yet, so every row routes to the planning page.
 */
import { useTranslation } from 'react-i18next'
import WidgetListBlock from '@/pages/dashboard/blocks/WidgetListBlock'
import { useDateFormat } from '@/lib/datetime'
import type { OpenShiftRow } from '@/types/dashboard'

export default function OpenShiftsList({ rows, onNavigate }: {
  rows: OpenShiftRow[]
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()
  const goToPlanning = () => onNavigate?.('planning')

  // Time range: start always shown, end appended only when known.
  const widgetRows = rows.map(r => ({
    key: r.shift_id,
    primary: r.order_title || t('widget.unknown'),
    meta: formatDate(r.start_time, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      + (r.end_time ? ' – ' + formatDate(r.end_time, { hour: '2-digit', minute: '2-digit' }) : ''),
    onClick: onNavigate ? goToPlanning : undefined,
  }))

  return (
    <WidgetListBlock title={t('block.openShiftsList')} action={t('feed.openPlanning')} onAction={goToPlanning} rows={widgetRows} />
  )
}
