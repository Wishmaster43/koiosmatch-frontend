/**
 * RecruiterLoad — K-173 fase 6, recruitment_manager only: one row per recruiter
 * in the order the server delivers (no client re-sort — the server's own
 * ordering, busiest first, is authoritative). Self-hides on an empty feed.
 *
 * Face (Danny 24-08: "moeten we mooier weergeven, is lelijk zo"): the
 * FunnelConversion idiom — avatar + name with the open-task count right-aligned,
 * a load bar relative to the busiest recruiter, and a calm caption line with the
 * planned intakes; too-long-in-stage renders as a warning-tinted chip ONLY when
 * it is non-zero (§4: colour carries meaning, never decoration).
 */
import { useTranslation } from 'react-i18next'
import { Block } from '../DashboardPrimitives'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { initialsOf } from '@/lib/initials'
import type { RecruiterLoadRow } from '@/types/dashboard'

export default function RecruiterLoad({ rows }: { rows: RecruiterLoadRow[] }) {
  const { t } = useTranslation('dashboard')
  if (!rows.length) return null

  // The bar scales against the busiest recruiter — a share, not an absolute.
  const top = rows.reduce((m, r) => Math.max(m, r.open_tasks), 0)

  return (
    <Block title={t('block.recruiterLoad')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 16px' }}>
        {rows.map(r => {
          const pct = top > 0 ? Math.round((r.open_tasks / top) * 100) : 0
          return (
            <div key={r.user_id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar initials={initialsOf(r.name, '–')} size={22} soft />
                <BodyText as="span" style={{ flex: 1, minWidth: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name || t('widget.unknown')}
                </BodyText>
                <Mono style={{ fontVariantNumeric: 'tabular-nums' }}>{r.open_tasks}</Mono>
                <Caption as="span">{t('recruiterLoad.openTasks')}</Caption>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden', marginBottom: 5 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--button-fill)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Caption as="span">{t('recruiterLoad.intakesCount', { count: r.intakes_planned })}</Caption>
                {r.too_long_in_stage > 0 && (
                  <SoftChip label={t('recruiterLoad.tooLongCount', { count: r.too_long_in_stage })} color="var(--color-warning)" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Block>
  )
}
