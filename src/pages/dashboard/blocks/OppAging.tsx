/**
 * OppAging — K-173 fase 6, sales_manager/accountmanager only: four equal-footprint
 * tiles for the opportunity-ageing buckets (0-7 / 8-30 / 31-90 / 90+ days).
 * Self-hides when the feed is absent (§3A equal-footprint tiles, mirrors KpiCard).
 */
import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import { KpiCard } from '../DashboardPrimitives'
import type { OppAgingBucket } from '@/types/dashboard'

// Fixed bucket order (server may omit an empty bucket entirely) so the row
// never reflows depending on which buckets happen to have data.
const BUCKET_ORDER: OppAgingBucket['bucket'][] = ['0-7', '8-30', '31-90', '90+']

export default function OppAging({ rows }: { rows: OppAgingBucket[] }) {
  const { t } = useTranslation('dashboard')
  if (!rows.length) return null
  const byBucket = new Map(rows.map(r => [r.bucket, r.count]))

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {BUCKET_ORDER.filter(b => byBucket.has(b)).map(b => (
        <KpiCard key={b} label={t(`oppAging.bucket.${b}`)} value={byBucket.get(b)}
          sub={t('oppAging.sub')} color="var(--color-secondary)" bg="var(--color-secondary-bg)" Icon={CalendarClock} />
      ))}
    </div>
  )
}
