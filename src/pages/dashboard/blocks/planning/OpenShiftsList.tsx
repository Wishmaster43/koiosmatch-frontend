import { useTranslation } from 'react-i18next'
import WidgetListBlock from '@/pages/dashboard/blocks/WidgetListBlock'
import { useDateFormat, toLocalIsoDate } from '@/lib/datetime'
import type { OpenShiftRow } from '@/types/dashboard'

/**
 * OpenShiftsList — planning work-feed tile: open shifts still needing a
 * candidate, rendered through the shared WidgetListBlock row idiom. A row
 * click carries `{ open: shift_id, date }` so the planning page lands on the
 * right day AND opens that shift's staffing drawer (PLANNING-INTENT-1).
 */
export default function OpenShiftsList({ rows, onNavigate }: {
  rows: OpenShiftRow[]
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()
  const goToPlanning = () => onNavigate?.('planning')
  // Row click: open that exact shift's staffing drawer on its own day — the
  // backend serialises `start_time` as a UTC instant, so a night shift can
  // fall on the previous UTC calendar day; derive the LOCAL day via the house
  // helper (matches the local day the row already displays via formatDate).
  const goToShift = (r: OpenShiftRow) => () => onNavigate?.('planning', { open: r.shift_id, date: toLocalIsoDate(new Date(r.start_time)) })

  // Time range: start always shown, end appended only when known.
  const widgetRows = rows.map(r => ({
    key: r.shift_id,
    primary: r.order_title || t('widget.unknown'),
    meta: formatDate(r.start_time, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      + (r.end_time ? ' – ' + formatDate(r.end_time, { hour: '2-digit', minute: '2-digit' }) : ''),
    onClick: onNavigate ? goToShift(r) : undefined,
  }))

  return (
    <WidgetListBlock title={t('block.openShiftsList')} action={t('feed.openPlanning')} onAction={goToPlanning} rows={widgetRows} />
  )
}
