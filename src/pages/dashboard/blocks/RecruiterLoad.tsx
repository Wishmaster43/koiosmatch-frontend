/**
 * RecruiterLoad — K-173 fase 6, recruitment_manager only: one row per recruiter
 * (open taken / intakes / te lang in fase), in the order the server delivers
 * (no client re-sort — the server's own ordering is authoritative). Self-hides
 * on an empty feed, mirroring the WidgetListBlock convention every other
 * dashboard tile follows.
 */
import { useTranslation } from 'react-i18next'
import { Block } from '../DashboardPrimitives'
import { BodyText, Caption } from '@/components/ui/typography'
import type { RecruiterLoadRow } from '@/types/dashboard'

export default function RecruiterLoad({ rows }: { rows: RecruiterLoadRow[] }) {
  const { t } = useTranslation('dashboard')
  if (!rows.length) return null

  return (
    <Block title={t('block.recruiterLoad')}>
      <div style={{ display: 'flex', padding: '8px 16px', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <Caption as="span" style={{ flex: 1 }}>{t('recruiterLoad.recruiter')}</Caption>
        <Caption as="span" style={{ width: 72, textAlign: 'right' }}>{t('recruiterLoad.openTasks')}</Caption>
        <Caption as="span" style={{ width: 72, textAlign: 'right' }}>{t('recruiterLoad.intakes')}</Caption>
        <Caption as="span" style={{ width: 88, textAlign: 'right' }}>{t('recruiterLoad.tooLong')}</Caption>
      </div>
      {rows.map((r, i) => (
        <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <BodyText as="div" style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.name || t('widget.unknown')}
          </BodyText>
          <BodyText as="div" style={{ width: 72, textAlign: 'right' }}>{r.open_tasks}</BodyText>
          <BodyText as="div" style={{ width: 72, textAlign: 'right' }}>{r.intakes_planned}</BodyText>
          <BodyText as="div" style={{ width: 88, textAlign: 'right' }}>{r.too_long_in_stage}</BodyText>
        </div>
      ))}
    </Block>
  )
}
