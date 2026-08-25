/**
 * RedeployRadarList — recruitment work-feed tile: candidates whose current
 * match is ending soon and need redeployment (dash.redeploy_radar). Rows
 * render via the shared WidgetListBlock (§3A: reuse, not re-invention).
 */
import { useTranslation } from 'react-i18next'
import WidgetListBlock from '../WidgetListBlock'
import { useDateFormat } from '@/lib/datetime'
import type { RedeployRadarRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function RedeployRadarList({ rows, onNavigate }: {
  rows: RedeployRadarRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()

  // Map the server rows to the shared list row shape; meta composes the end
  // date with the days-left count, and clicking opens the match drawer.
  const listRows = rows.map(r => ({
    key: r.match_id,
    primary: r.candidate?.name || t('widget.unknown'),
    secondary: r.customer?.name,
    meta: `${formatDate(r.end_date)} · ${t('kpi.daysValue', { count: r.days_left })}`,
    onClick: onNavigate ? () => onNavigate('matches', { open: r.match_id }) : undefined,
  }))

  return <WidgetListBlock title={t('block.redeployRadar')} rows={listRows} />
}
