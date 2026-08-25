/**
 * ShiftCoverageHeatmap — planning work-feed tile: a fixed 7x3 grid (dates x
 * morning/afternoon/evening) showing filled/shifts per cell, tinted by fill
 * ratio. Numbers stay visible so colour is never the only signal (§6). A cell
 * click carries `{ date: cell.date }` so the planning page opens on that day
 * (PLANNING-INTENT-1).
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import { Mono, Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { tintBg } from '@/lib/tint'
import { interactive } from '@/lib/a11y'
import type { ShiftCoverageCell } from '@/types/dashboard'

const PARTS: ShiftCoverageCell['part'][] = ['morning', 'afternoon', 'evening']

export default function ShiftCoverageHeatmap({ rows, onNavigate }: {
  rows: ShiftCoverageCell[]
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()

  // Build the stable 7-date x 3-part matrix; missing cells default to 0/0.
  const dates = Array.from(new Set(rows.map(r => r.date))).sort()
  const byKey = new Map(rows.map(r => [`${r.date}|${r.part}`, r]))
  const goToPlanning = () => onNavigate?.('planning')

  return (
    <Block title={t('block.shiftCoverageHeatmap')} action={t('feed.openPlanning')} onAction={goToPlanning}>
      <div style={{ padding: 16, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${dates.length}, 1fr)`, gap: 4, minWidth: 480 }}>
          <div />
          {dates.map(d => (
            <Caption key={d} as="div" style={{ textAlign: 'center' }}>{formatDate(d, { day: '2-digit', month: '2-digit' })}</Caption>
          ))}
          {PARTS.map(part => (
            <Fragment key={part}>
              <Caption as="div" style={{ display: 'flex', alignItems: 'center' }}>{t(`feed.part.${part}`)}</Caption>
              {dates.map(d => {
                const cell = byKey.get(`${d}|${part}`) ?? { date: d, part, shifts: 0, filled: 0 }
                const token = cell.shifts === 0
                  ? 'var(--text-muted)'
                  : cell.filled >= cell.shifts
                    ? 'var(--color-success)'
                    : cell.filled >= cell.shifts / 2
                      ? 'var(--color-warning)'
                      : 'var(--color-danger)'
                // Cell click jumps the board window to this exact day.
                const goToDay = () => onNavigate?.('planning', { date: d })
                return (
                  <div key={`${d}|${part}`}
                    // Only wired when onNavigate is actually provided, mirroring OpenShiftsList.
                    {...(onNavigate ? interactive(goToDay) : {})}
                    title={t('feed.coverage', { filled: cell.filled, shifts: cell.shifts })}
                    style={{ background: tintBg(token, true), borderRadius: 6, padding: '8px 4px',
                      textAlign: 'center', cursor: onNavigate ? 'pointer' : 'default' }}>
                    <Mono style={{ fontSize: 11 }}>{cell.filled}/{cell.shifts}</Mono>
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </Block>
  )
}
