/**
 * NoteFeedList — NOTITIE-DOORLINK-1 (read side), FE surface. A self-contained
 * "Linked notes" section for the candidate/customer notes tab (FROZEN screens,
 * sanctioned ADDITIVE class — nothing existing changes, see the two hosts).
 *
 * MEASURED (against the landed BE contract, commit 1d71ce3f): the feed returns
 * BOTH direct notes (written on this principal itself) and chain-linked ones
 * (`is_direct: false`, written on a linked application/match/vacancy/…). The
 * host's own notes list already renders the direct notes in the existing
 * NoteRow idiom — rendering them again here would double the thread. So this
 * section shows ONLY `is_direct: false` rows ("Linked notes"), which makes the
 * overlap impossible by construction rather than by a runtime de-dupe. The
 * "only direct" toggle then has nothing left to show for this section — instead
 * of rendering an always-empty list, flipping it simply hides the section
 * (the simplest honest shape, per the brief).
 *
 * Read-only by design: editing happens at the source (the host record), so
 * rows carry no pencil/bin/pop-out — only the NOTITIE-REFERENTIE row shape
 * (type chip + author + date) plus the source chip.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import EntityLink from '@/components/ui/EntityLink'
import FieldNotice from '@/components/ui/FieldNotice'
import SafeHtml from '@/components/ui/SafeHtml'
import Toggle from '@/components/ui/Toggle'
import { Caption, GroupLabel } from '@/components/ui/typography'
import Spinner from '@/components/ui/Spinner'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useNoteFeed } from '@/hooks/useNoteFeed'
import type { NoteFeedEntity, NoteFeedItem, NoteFeedSource, NoteFeedSubScope } from '@/hooks/useNoteFeed'
import type { Id } from '@/types/common'

// source.type (NoteSourceResolver) → the app's own page id (NavigationContext/appPages.tsx).
// 'unknown' and any future family without a mapping simply render no link (source.id is
// null for those anyway, per NoteSourceResolver::chip).
const SOURCE_PAGE: Record<string, string> = {
  candidate: 'candidates',
  customer: 'customers',
  application: 'applications',
  match: 'matches',
  opportunity: 'opportunities',
  vacancy: 'vacancies',
  task: 'tasks',
}

interface NoteFeedListProps {
  entity: NoteFeedEntity
  id: Id | null | undefined
  // Customer sub-entity principal (location/department/contact feed routes,
  // CMBE 64d976ff) — `id` is then the OWNING customer's id.
  sub?: NoteFeedSubScope
}

// The source reference: the shared EntityLink (name opens in-app, trailing icon
// opens a new tab — its own canonical faces and tooltips) while the host lives;
// a deleted/unknown host degrades to plain text with the (deleted) suffix —
// Danny's rule verbatim: the hyperlink becomes ordinary text, never a dead link.
function SourceRef({ source }: { source: NoteFeedSource }) {
  const { t } = useTranslation('common')
  const page = SOURCE_PAGE[source.type]
  const label = source.label ?? source.type
  if (source.deleted || !page || source.id == null) {
    return <Caption as="span">{t('notes.feed.sourceDeleted', { label })}</Caption>
  }
  return <EntityLink page={page} id={source.id} title={label} tone="neutral">{label}</EntityLink>
}

// One read-only feed row — NOTITIE-REFERENTIE shape (type chip + author + date), plus the source ref.
// The chip label is server-resolved (`type_label`, CMBE 64d976ff) — never a raw
// slug; the lookup match below only supplies the tenant colour, with the
// pre-64d976ff resolve kept as the §10-tolerant label fallback.
function FeedRow({ item, noteTypes }: { item: NoteFeedItem; noteTypes: { value: string; label: string; color?: string | null }[] }) {
  const { t } = useTranslation('common')
  const { formatDateTime } = useDateFormat()
  const resolved = item.type ? noteTypes.find(n => n.value === item.type || n.label === item.type) : undefined
  const chipLabel = item.type_label ?? resolved?.label ?? null
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <Avatar initials={item.author ? initialsOf(item.author) : undefined} size={26} />
      <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
          <SourceRef source={item.source} />
          {chipLabel && <SoftChip label={chipLabel} color={resolved?.color ?? 'var(--color-primary)'} round size={10} />}
          <Caption as="span" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {item.author ? `${item.author} · ` : ''}{formatDateTime(item.created_at)}
          </Caption>
        </div>
        {/* AUTHZ-NOTEFEED-1: a masked body states so honestly (italic = §4
            empty-state voice) instead of rendering a silent blank block. */}
        {item.body_masked
          ? <Caption as="div" style={{ fontStyle: 'italic' }}>{t('notes.feed.masked')}</Caption>
          : <SafeHtml style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} html={item.body ?? ''} />}
      </div>
    </div>
  )
}

// The "Linked notes" section — self-contained (owns its own fetch + toggle state).
export default function NoteFeedList({ entity, id, sub }: NoteFeedListProps) {
  const { t } = useTranslation('common')
  // Only-direct toggle: since this section only ever shows is_direct:false rows
  // (see file docblock), flipping it to "direct only" would always render empty —
  // so it hides the section instead, the honest shape.
  const [onlyDirect, setOnlyDirect] = useState(false)
  // only_linked=1 asks the server for the chain-linked subset (CMBE fast-follow);
  // the client filter below stays as the §10-tolerant fallback until it lands.
  const { items, loading, error, hasMore, loadingMore, loadMore, reload } = useNoteFeed(entity, id, true, sub)
  const noteTypeEntity = entity === 'candidates' ? 'candidate' : 'customer'
  const { types: noteTypes } = useNoteTypes(noteTypeEntity as never)
  const linkedItems = items.filter(i => !i.is_direct)

  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <GroupLabel as="span">{t('notes.feed.title')}</GroupLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <Caption as="span">{t('notes.feed.onlyDirect')}</Caption>
          <Toggle checked={onlyDirect} onChange={setOnlyDirect} ariaLabel={t('notes.feed.onlyDirect')} />
        </div>
      </div>
      {/* The toggle hides the section rather than rendering an always-empty list. */}
      {onlyDirect ? null : (
        <>
          {loading && <Spinner size={16} label={t('notes.feed.loading')} />}
          {!loading && error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <FieldNotice severity="error" text={t('notes.feed.loadError')} />
              <Button variant="ghost" size="sm" onClick={reload}>{t('error.retry')}</Button>
            </div>
          )}
          {/* Empty is only claimed once EVERY page is in — while more pages exist
              the load-more below speaks, never a false "no linked notes". */}
          {!loading && !error && linkedItems.length === 0 && !hasMore && (
            <Caption as="span">{t('notes.feed.empty')}</Caption>
          )}
          {!loading && !error && linkedItems.map(item => <FeedRow key={`${item.note_type}-${item.id}`} item={item} noteTypes={noteTypes ?? []} />)}
          {!loading && !error && hasMore && (
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t('notes.feed.loadingMore') : t('notes.feed.loadMore')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
