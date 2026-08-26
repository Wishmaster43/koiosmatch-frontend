/**
 * CustomersAtRiskList — sales_manager tile: customers gone quiet, from
 * dash.customers_at_risk_list. Reuses the shared WidgetListBlock row idiom;
 * each row deep-links to that customer's drawer.
 */
import { useTranslation } from 'react-i18next'
import WidgetListBlock from '@/pages/dashboard/blocks/WidgetListBlock'
import type { WidgetRow } from '@/pages/dashboard/blocks/WidgetListBlock'
import { useDateFormat } from '@/lib/datetime'
import type { CustomerAtRiskRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// At-risk customers widget list: each row meta shows days-quiet plus the last-contact date when known, and clicks drill into the customer record.
export default function CustomersAtRiskList({ rows, onNavigate }: {
  rows: CustomerAtRiskRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()

  // Meta = days quiet, plus last contact date when known (DD-MM-YYYY, house formatter).
  const widgetRows: WidgetRow[] = rows.map(r => ({
    key: r.id,
    primary: r.name,
    secondary: r.owner,
    meta: r.last_contact_at
      ? `${t('feed.daysQuiet', { count: r.days_quiet })} · ${formatDate(r.last_contact_at)}`
      : t('feed.daysQuiet', { count: r.days_quiet }),
    onClick: onNavigate ? () => onNavigate('customers', { open: r.id }) : undefined,
  }))

  return <WidgetListBlock title={t('block.customersAtRiskList')} rows={widgetRows} />
}
