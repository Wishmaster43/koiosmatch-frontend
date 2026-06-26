import { useTranslation } from 'react-i18next'
import Avatar from '../../../components/ui/Avatar'
import KoiosAiMark from '../../../components/ui/KoiosAiMark'
import type { VacancyDetail } from '../../../types/vacancy'

/**
 * TimelineTab — read-only activity feed for a vacancy (created, status changes,
 * applications received…). AI-generated entries carry the Koios mark.
 */
export default function TimelineTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const items = v.timeline ?? []

  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('statistics.empty')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(ev => (
        <div key={ev.id} style={{ display: 'flex', gap: 10 }}>
          <Avatar initials={ev.initials} size={26} soft />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.author || '—'}</span>
              {ev.ai && <KoiosAiMark size={14} />}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{ev.time}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ev.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
