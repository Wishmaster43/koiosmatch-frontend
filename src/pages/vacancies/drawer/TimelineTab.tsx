/**
 * TimelineTab — read-only merged activity feed for a vacancy. A thin adapter: it
 * maps the vacancy's events onto the shared EventTimeline (continuous axis, mono
 * time, per-day headings) and owns only the vacancy's own event vocabulary, so
 * this tab and the application Tijdlijn are literally the same component. See
 * the default export's own doc comment below for the full rationale.
 */
import { useTranslation } from 'react-i18next'
import { FilePlus2, Globe, Handshake, MessageSquare, Pencil, UserPlus } from 'lucide-react'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import EntityLink from '@/components/ui/EntityLink'
import EventTimeline, { type TimelineKindMeta } from '@/components/ui/EventTimeline'
import type { VacancyDetail } from '@/types/vacancy'

// V21-23: tooltip per linkable event kind. An explicit map (not a built key
// string) so a missing translation is visible here instead of silently
// resolving to a dynamic key that no locale file carries.
const OPEN_LABEL_KEY: Record<string, string> = {
  application: 'timeline.openApplication',
  match: 'timeline.openMatch',
}

// Event kind → its icon + semantic token. `vacancy_created/updated/published` are
// what VacancyTimeline.php actually emits (verified live against GET /vacancies/{id});
// note/application/match are the neighbouring kinds it can merge in. Colour is spent
// ONLY here, where it carries the event's meaning (§4).
const KIND_META: Record<string, TimelineKindMeta> = {
  vacancy_created:   { icon: FilePlus2, color: 'var(--color-primary)' },
  vacancy_updated:   { icon: Pencil, color: 'var(--text-muted)' },
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: event-kind colour VALUE for the marker tint recipes (tintBg/chipInk downstream), not text ink
  vacancy_published: { icon: Globe, color: 'var(--color-success)' },
  note:              { icon: MessageSquare, color: 'var(--color-secondary)' },
  application:       { icon: UserPlus, color: 'var(--color-info)' },
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: event-kind colour VALUE for the marker tint recipes (tintBg/chipInk downstream), not text ink
  match:             { icon: Handshake, color: 'var(--color-success)' },
}

/**
 * TimelineTab — read-only merged activity feed for a vacancy. A thin adapter: it
 * maps the vacancy's events onto the shared EventTimeline (continuous axis, mono
 * time, per-day headings) and owns only the vacancy's own event vocabulary, so
 * this tab and the application Tijdlijn are literally the same component.
 * Events that point at a record we can open render their text as an EntityLink;
 * notes have no own page and stay plain text — never a link that 404s.
 * Author is the muted meta line and is dropped when absent: it is null on every
 * event the backend currently emits, and the old layout printed that gap as a
 * bold "—" at the top of the row.
 *
 * Loading/error are not passed: this tab renders inside a drawer that has already
 * resolved both before it mounts, so there is no honest signal to forward — the
 * states themselves live (and are tested) in EventTimeline.
 */
export default function TimelineTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const items = v.timeline ?? []

  return (
    <EventTimeline
      emptyText={t('timeline.empty')}
      kindMeta={kind => KIND_META[kind]}
      events={items.map((ev, i) => {
        // The mapper already resolved the target; the tab only decides how to render it.
        const openKey = OPEN_LABEL_KEY[ev.type]
        const openLabel = openKey ? t(openKey) : undefined
        return {
          id: ev.id ?? i,
          time: ev.time,
          kind: ev.type,
          text: ev.linkPage && ev.linkId
            ? <EntityLink page={ev.linkPage} id={ev.linkId} title={openLabel}>{ev.description}</EntityLink>
            : ev.description,
          meta: ev.author || null,
          trailing: ev.ai ? <AiGeneratedLabel size={10} /> : null,
        }
      })}
    />
  )
}
