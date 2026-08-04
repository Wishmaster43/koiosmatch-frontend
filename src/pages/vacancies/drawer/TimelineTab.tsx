import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import TimelineRail from '@/components/ui/TimelineRail'
import { useDateFormat } from '@/lib/datetime'
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
 * A TimelineRail connects the dots (Danny 05-08: isolated bolletjes, no line) and
 * `time` renders through the house DD-MM-YYYY HH:mm formatter, never the
 * mapper's raw ISO value.
 */
export default function TimelineTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { formatDateTime } = useDateFormat()
  const items = v.timeline ?? []

  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('timeline.empty')}</div>
  }

  return (
    // No gap here: each row's own paddingBottom carries the spacing so the
    // TimelineRail's connector line reaches all the way to the next dot.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((ev, i) => {
        // The mapper already resolved the target; the tab only decides how to render it.
        const openKey = OPEN_LABEL_KEY[ev.type]
        const openLabel = openKey ? t(openKey) : undefined
        return (
          <div key={ev.id} style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
            <TimelineRail isLast={i === items.length - 1} />
            <Avatar initials={ev.initials} size={26} soft />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.author || '—'}</span>
                {ev.ai && <KoiosAiMark size={14} />}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDateTime(ev.time)}</span>
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
