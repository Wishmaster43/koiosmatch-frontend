/**
 * useNoteFeed — NOTITIE-DOORLINK-1 (read side): the cross-source note feed for
 * one stamdata principal (candidate or customer). Wraps
 * `GET /{entity}/{id}/note-feed`, newest-first, every note filed under this
 * principal across all note families (via note_links) — distinct from the
 * entity's own notes list, which only ever shows its DIRECT notes.
 * Shape hand-typed against the landed BE contract (§10 — no matching
 * `paths`/`operations` entry in api-generated.ts yet): commit 1d71ce3f
 * (`app/Services/Notes/NoteFeedService.php::item()` + `NoteSourceResolver`),
 * response is a Laravel `LengthAwarePaginator::toJson()` — `unwrapList`
 * already tolerates that shape via its `meta ?? obj` fallback.
 * Pagination via `useInfiniteQuery` (React Query, K-33) — a load-more button
 * calls `loadMore`, accumulating pages client-side.
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

// The two top-level principals this feed exists for (NOTITIE-DOORLINK-1 scope).
export type NoteFeedEntity = 'candidates' | 'customers'

// Customer sub-entity principals (fast-follow routes, CMBE 64d976ff): the feed
// URL nests under the owning customer — IDOR-safe by construction server-side.
export interface NoteFeedSubScope {
  kind: 'locations' | 'departments' | 'contacts'
  id: Id
}

// The host a note was written on (NoteSourceResolver::sourceFor) — degrades to
// `deleted: true` (best-effort label kept) when the host is gone, never a dead link.
export interface NoteFeedSource {
  type: string
  id: string | null
  label: string | null
  deleted: boolean
}

// One feed item (NoteFeedService::item) — read-only here; editing happens at the source.
export interface NoteFeedItem {
  id: string | number
  note_type: string
  source: NoteFeedSource
  body: string | null
  type: string | null
  // Human note-type label resolved server-side per family lookup (64d976ff);
  // null when the slug has no label — render this, never re-map the slug.
  type_label?: string | null
  // AUTHZ-NOTEFEED-1 (19602aff): true when the reader lacks candidates.view and
  // the note carries a candidate — body suppressed, principal nameless.
  body_masked?: boolean
  author: string | null
  language: string | null
  created_at: string
  updated_at: string
  is_direct: boolean
  principals: Array<{ type: string; id: string; label: string | null }>
}

const PER_PAGE = 25

export interface UseNoteFeedResult {
  items: NoteFeedItem[]
  loading: boolean
  error: boolean
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
  reload: () => void
}

// Fetches one principal's cross-source note feed. `onlyLinked` requests the
// chain-linked subset server-side (only_linked=1, CMBE fast-follow); until the
// server honours it the response still carries both kinds and the CALLER keeps
// its client filter as the §10-tolerant fallback.
export function useNoteFeed(entity: NoteFeedEntity, id: Id | null | undefined, onlyLinked: boolean, sub?: NoteFeedSubScope): UseNoteFeedResult {
  // Sub-entity feeds nest under the owning customer; top-level feeds stay flat.
  const path = sub ? `/customers/${id}/${sub.kind}/${sub.id}/note-feed` : `/${entity}/${id}/note-feed`
  const query = useInfiniteQuery({
    queryKey: ['note-feed', entity, id, onlyLinked, sub?.kind, sub?.id],
    queryFn: async ({ pageParam, signal }) => {
      const res = await api.get(path, {
        signal,
        params: { ...(onlyLinked ? { only_linked: 1 } : {}), per_page: PER_PAGE, page: pageParam },
      })
      return unwrapList<NoteFeedItem>(res)
    },
    initialPageParam: 1,
    // The BE reports current_page/last_page (raw paginator json) — one more page
    // while the current page hasn't reached the last.
    getNextPageParam: last => (last.page < last.lastPage ? last.page + 1 : undefined),
    enabled: id != null && (sub == null || sub.id != null),
  })

  return {
    items: query.data?.pages.flatMap(p => p.rows) ?? [],
    loading: query.isLoading,
    error: query.isError,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMore: () => { void query.fetchNextPage() },
    reload: () => { void query.refetch() },
  }
}
