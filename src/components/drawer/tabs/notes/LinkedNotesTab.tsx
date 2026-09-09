/**
 * LinkedNotesTab — K-288 (Danny 04-09, relayed): "Gekoppelde notities" as its
 * OWN subtab under Communicatie, not the retired inline NoteFeedList section
 * today. Same underlying cross-source feed (useNoteFeed) and the same row
 * shape (LinkedNoteRow's FeedRow/SourceRef, §11 — nothing duplicated), plus
 * two things the inline section never had: a source-type filter and a per-row
 * pencil/pop-out action cluster, both gated on the feed item's own
 * `can_manage` (bundle H) — never guessed from the author name (§3).
 *
 * TOOLBAR (Danny 04-09, verbatim relayed: "gekoppelde notities wel zo maken
 * als notities, dus zoekbalk en filter in huisstijl!") — this is NOT a bespoke
 * toolbar: it is NotesTab's own header, copied verbatim (search box left/growing
 * + one `DrawerFilterMenu` right, no section title — the sub-tab already names
 * itself). Search is CLIENT-SIDE over the loaded feed (the backend has no
 * search param on note-feed, mirrors NotesTab's own documented behaviour: it
 * only ever narrows what is ALREADY loaded). The source-type filter is
 * SERVER-SIDE since backend bundle H (71e7e434): `?source_type=<type>` reaches
 * useNoteFeed, which refetches page 1, so a filtered view never shows "5 of the
 * 25 loaded rows". "Alleen directe notities" moved INTO the filter panel too, as a
 * `type: 'toggle'` row (DrawerFilterMenu, K-288) — same honest-empty-state
 * behaviour as the retired NoteFeedList section: ON shows nothing (this
 * feed only ever carries `is_direct:false` rows by construction), OFF shows
 * the linked rows.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import FieldNotice from '@/components/ui/FieldNotice'
import Spinner from '@/components/ui/Spinner'
import { Caption } from '@/components/ui/typography'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useNoteFeed } from '@/hooks/useNoteFeed'
import type { NoteFeedEntity, NoteFeedSubScope } from '@/hooks/useNoteFeed'
import type { Id } from '@/types/common'
import { FeedRow } from './LinkedNoteRow'

// Fixed filter order — mirrors the seven note-write families in linkedNoteApi's
// LINKED_NOTE_ROUTE (the same families the pencil/pop-out cluster can reach).
const SOURCE_TYPES = ['candidate', 'customer', 'application', 'match', 'opportunity', 'vacancy', 'task'] as const

// Strips HTML tags before a plain-text search match (rich-text field — a raw
// substring match on markup would false-positive/negative); mirrors NotesTab's
// own local helper (no shared export exists for this one-liner, §11 n/a).
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ')

interface LinkedNotesTabProps {
  entity: NoteFeedEntity
  id: Id | null | undefined
  // Customer sub-entity principal (location/department/contact feed routes,
  // CMBE 64d976ff) — `id` is then the OWNING customer's id.
  sub?: NoteFeedSubScope
}

// The "Gekoppelde notities" subtab content — search + filter toolbar, then
// rows, each carrying its own pencil/pop-out action cluster (LinkedNoteRow).
export default function LinkedNotesTab({ entity, id, sub }: LinkedNotesTabProps) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [onlyDirect, setOnlyDirect] = useState(false)
  // The source-type filter is a server param (bundle H): '' = all sources → null.
  const { items, loading, error, hasMore, loadingMore, loadMore, reload } =
    useNoteFeed(entity, id, true, sub, sourceType || null)
  const noteTypeEntity = entity === 'candidates' ? 'candidate' : 'customer'
  const { types: noteTypes } = useNoteTypes(noteTypeEntity as never)

  // Client-side search narrowing over the already-loaded page(s); the source type is already server-filtered.
  const q = search.trim().toLowerCase()
  const filteredItems = items
    .filter(item => !q
      || stripHtml(String(item.body ?? '')).toLowerCase().includes(q)
      || String(item.source.label ?? '').toLowerCase().includes(q)
      || String(item.author ?? '').toLowerCase().includes(q))

  // DrawerFilterMenu rows: the source-type dropdown + the "only direct" switch
  // (NOTE-FILTERS-1 idiom — behind one compact Filter button, never inline).
  const filterRows: DrawerFilterConfig[] = [
    {
      type: 'single', key: 'sourceType', label: t('notes.feed.filterLabel'), value: sourceType, onChange: setSourceType,
      allLabel: t('notes.feed.allSources'),
      options: SOURCE_TYPES.map(type => ({ value: type, label: t(`notes.feed.sourceType.${type}`) })),
    },
    {
      type: 'toggle', key: 'onlyDirect', label: t('notes.feed.onlyDirect'), ariaLabel: t('notes.feed.onlyDirect'),
      value: onlyDirect, onChange: setOnlyDirect,
    },
  ]

  return (
    <>
      {/* No section title (mirrors NotesTab: the sub-tab already names itself) —
          search box left/growing, filter button right, drill-down's standard footprint. */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('notes.feed.search')}
            aria-label={t('notes.feed.search')}
            style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none', flex: 1, minWidth: 0 }} />
        </div>
        <DrawerFilterMenu filters={filterRows}
          label={t('filters.button', { defaultValue: 'Filter' })}
          title={t('filters.title')} clearAllLabel={t('filters.clearAll')} />
      </div>
      {/* "Alleen directe notities" ON: this feed only ever carries is_direct:false
          rows by construction (only_linked=1 below), so honesty means the empty
          state — never a fake filtered list. */}
      {onlyDirect ? (
        <Caption as="span">{t('notes.feed.empty')}</Caption>
      ) : (
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
          {!loading && !error && filteredItems.length === 0 && !hasMore && (
            <Caption as="span">{t('notes.feed.empty')}</Caption>
          )}
          {!loading && !error && filteredItems.map(item => (
            <FeedRow key={`${item.note_type}-${item.id}`} item={item} noteTypes={noteTypes ?? []} onReload={reload} />
          ))}
          {!loading && !error && hasMore && (
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t('notes.feed.loadingMore') : t('notes.feed.loadMore')}
            </Button>
          )}
        </>
      )}
    </>
  )
}
