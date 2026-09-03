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
 * Rows carry the NOTITIE-REFERENTIE row shape (type chip + author + date) plus the
 * source link, on the SAME face as NoteRow (title 12/600, body 12/400) — measured
 * 04-09 on Ahmed Bakker: the source link inherited the drawer's 16px/400 through
 * EntityLink's `font: inherit`, which is what Danny saw as "a bigger, heavier
 * card". FeedRow/SourceRef now live in LinkedNoteRow.tsx (shared with
 * LinkedNotesTab, K-288 — see that file's docblock) so this section keeps the
 * exact same read-only rendering by importing them back.
 *
 * SUPERSEDED (K-288, Danny 04-09): the pencil/pop-out per-row actions this
 * section used to defer landed on a NEW subtab, `LinkedNotesTab`
 * (components/drawer/tabs/notes/LinkedNotesTab.tsx) — a full "Gekoppelde
 * notities" tab under Communicatie with a source-type filter and the
 * pencil/pop-out cluster. This section stays as the frozen candidate/customer
 * drill-down's own inline block until a host migrates to the subtab; nothing
 * here changes for that migration to happen.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import FieldNotice from '@/components/ui/FieldNotice'
import Toggle from '@/components/ui/Toggle'
import { Caption, GroupLabel } from '@/components/ui/typography'
import Spinner from '@/components/ui/Spinner'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useNoteFeed } from '@/hooks/useNoteFeed'
import type { NoteFeedEntity, NoteFeedSubScope } from '@/hooks/useNoteFeed'
import type { Id } from '@/types/common'
import { FeedRow } from './LinkedNoteRow'

interface NoteFeedListProps {
  entity: NoteFeedEntity
  id: Id | null | undefined
  // Customer sub-entity principal (location/department/contact feed routes,
  // CMBE 64d976ff) — `id` is then the OWNING customer's id.
  sub?: NoteFeedSubScope
}

// The "Linked notes" section — self-contained (owns its own fetch + toggle state).
export default function NoteFeedList({ entity, id, sub }: NoteFeedListProps) {
  const { t } = useTranslation('common')
  // Only-direct toggle: since this section only ever shows is_direct:false rows
  // (see file docblock), flipping it to "direct only" would always render empty —
  // so it hides the section instead, the honest shape.
  const [onlyDirect, setOnlyDirect] = useState(false)
  // only_linked=1: the server returns only chain-linked rows (live since BE
  // 97a1aac1) — no client-side re-filter needed.
  const { items, loading, error, hasMore, loadingMore, loadMore, reload } = useNoteFeed(entity, id, true, sub)
  const noteTypeEntity = entity === 'candidates' ? 'candidate' : 'customer'
  const { types: noteTypes } = useNoteTypes(noteTypeEntity as never)
  const linkedItems = items

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
