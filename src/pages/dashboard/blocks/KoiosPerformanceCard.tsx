/**
 * KoiosPerformanceCard — the management/admin "Koios AI performance" face
 * (PLAN-DASHBOARD-PER-ROL-V3 + Danny 24-08 on the first build: "compact, KPI
 * blokjes ... openklappen ... hyperlink en open in nieuw scherm — snap je??").
 * It IS the KoiosForYouCard idiom, reused wholesale: the same translated
 * category tiles, the same expandable per-category table with record links —
 * tenant-wide (no scope param, K-182) under the performance title. The ONLY
 * addition is a compact footer strip from GET /ai/koios/performance (K-181):
 * executed/failed/other tiles, the top-5 users and the day trend — collapsed
 * behind one disclosure so the card stays calm. Raw per_type/per_source keys
 * never render: the category tiles already carry that breakdown, translated.
 * 403 on the performance call (koios.use) hides just the strip; the card
 * itself follows the for-you call's own gating.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useNumberFormat } from '@/lib/formatters'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import StatTile from '@/components/ui/StatTile'
import LineChartCard from '@/components/charts/LineChartCard'
import { GroupLabel, BodyText, Caption, Mono } from '@/components/ui/typography'
import { initialsOf } from '@/lib/initials'
import KoiosForYouCard from '../KoiosForYouCard'

// Hand-written shape (§10: no api-generated entry for this route yet).
interface KoiosPerformanceReport {
  period: string
  actions_total: number
  per_type: Record<string, number>
  per_source: Record<string, number>
  executed: { completed: number; failed: number; other: number }
  top_users: { user_id: string | number; name: string; count: number }[]
  timeseries: { date: string; count: number }[]
}

// The compact performance strip under the shared card — one disclosure.
function PerformanceStrip() {
  const { t } = useTranslation('dashboard')
  const { formatNumber } = useNumberFormat()
  const [open, setOpen] = useState(false)

  const { data, isError } = useQuery({
    queryKey: ['koios', 'performance'],
    queryFn: async ({ signal }) =>
      unwrap<KoiosPerformanceReport>(await api.get('/ai/koios/performance', { params: { days: 30 }, signal })),
  })

  // No rights / no data → no strip; the shared card above stays intact (§3:
  // a routine rights gap is never an alarming banner on a dashboard block).
  if (isError || !data) return null

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <GroupLabel as="span" style={{ flex: 1 }}>{t('koiosPerformance.stripTitle')}</GroupLabel>
        <Button variant="ghost" iconOnly size="sm"
          aria-label={t(open ? 'koiosPerformance.collapse' : 'koiosPerformance.expand')}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}>
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.1s' }} />
        </Button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          {/* Executed split — three tiles in the shared atom, colour + icon + text (§6). */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <StatTile size="sm" labelFirst label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={12} color="var(--color-success)" aria-hidden="true" />{t('koiosPerformance.completed')}
              </span>} value={formatNumber(data.executed.completed)} />
            <StatTile size="sm" labelFirst label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <XCircle size={12} color="var(--color-danger)" aria-hidden="true" />{t('koiosPerformance.failed')}
              </span>} value={formatNumber(data.executed.failed)} />
            <StatTile size="sm" labelFirst label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <HelpCircle size={12} color="var(--text-muted)" aria-hidden="true" />{t('koiosPerformance.other')}
              </span>} value={formatNumber(data.executed.other)} />
          </div>

          {/* Top-5 users — avatar + name + Mono count, calm rows. */}
          {data.top_users.length > 0 && (
            <div>
              <GroupLabel style={{ marginBottom: 6 }}>{t('koiosPerformance.topUsers')}</GroupLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.top_users.map(u => (
                  <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar initials={initialsOf(u.name, '–')} size={20} soft />
                    <BodyText as="span" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</BodyText>
                    <Mono style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(u.count)}</Mono>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day trend — the shared line chart; hidden when the series is empty. */}
          {data.timeseries.length > 0 ? (
            <LineChartCard title={t('koiosPerformance.trend')} data={data.timeseries.map(p => ({ name: p.date, value: p.count }))} />
          ) : (
            <Caption>{t('koiosPerformance.noTrend')}</Caption>
          )}
        </div>
      )}
    </div>
  )
}

export default function KoiosPerformanceCard() {
  const { t } = useTranslation('dashboard')
  // One idiom: the shared card, tenant-wide, with the performance strip below.
  return <KoiosForYouCard title={t('koiosPerformance.title')} footer={<PerformanceStrip />} />
}
