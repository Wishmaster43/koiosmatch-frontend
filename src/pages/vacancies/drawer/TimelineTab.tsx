import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import type { VacancyDetail } from '@/types/vacancy'

// V21-23: tooltip per linkable event kind. An explicit map (not a built key
// string) so a missing translation is visible here instead of silently
// resolving to a dynamic key that no locale file carries.
const OPEN_LABEL_KEY: Record<string, string> = {
  application: 'timeline.openApplication',
  match: 'timeline.openMatch',
}

/**
 * TimelineTab — read-only merged activity feed for a vacancy (notes,
 * applications received, matches made — VacancyTimeline.php). Events that point
 * at a record we can open render their description as an EntityLink: the text
 * opens the record in-app, its trailing icon opens it in a new tab. Notes have
 * no own page and stay plain text. AI-generated entries carry the Koios mark.
 */
export default function TimelineTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const items = v.timeline ?? []

  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('timeline.empty')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(ev => {
        // The mapper already resolved the target; the tab only decides how to render it.
        const openKey = OPEN_LABEL_KEY[ev.type]
        const openLabel = openKey ? t(openKey) : undefined
        return (
          <div key={ev.id} style={{ display: 'flex', gap: 10 }}>
            <Avatar initials={ev.initials} size={26} soft />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.author || '—'}</span>
                {ev.ai && <KoiosAiMark size={14} />}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{ev.time}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {ev.linkPage && ev.linkId
                  ? <EntityLink page={ev.linkPage} id={ev.linkId} title={openLabel}>{ev.description}</EntityLink>
                  : ev.description}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
