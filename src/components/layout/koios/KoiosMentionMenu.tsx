/**
 * KoiosMentionMenu — the "@" picker floated above the composer. Two modes:
 *  - default (no category chosen yet): a live FAN-OUT search (KOIOS-MENTION-
 *    BREED-1, Danny, verbatim: "@ moet op alle hoofdobjecten
 *    zoeken" — i.e. "@ must search across all main objects") — from 2 typed
 *    characters, every VISIBLE category with search wiring (koiosMentionCategories.ts
 *    + koiosMentionAccess.isCategoryVisible) is queried in parallel
 *    (useKoiosMultiEntitySearch), each rendered as its own grouped, capped
 *    section — above the category list. Replaces the old candidates-only default.
 *  - scoped (a category was clicked): the category list is replaced by a live
 *    search WITHIN that one category (KOIOS-SEARCH-1, useKoiosEntitySearch),
 *    e.g. "@Vacatures verpl" searches vacancies for "verpl". mentionScope.ts
 *    decides when the typed tail still belongs to the chosen category.
 * Categories the user lacks access to (koiosMentionAccess) are hidden outright.
 * Picking any row hands the hit back to KoiosPanel, which records a context ref
 * + chip (candidate today; every other type client-side-only, see
 * koiosContextTypes.ts).
 *
 * KEYBOARD (WCAG 2.2 AA §6): every pickable row — scoped results, each fan-out
 * group's rows, the category list — is ONE flat, ordered ARIA listbox
 * (role="listbox" here, role="option" per row). A listbox's owned children
 * must be option/group (KOIOS-SEARCH-FIX-2): each section's rows sit inside
 * their own role="group" labelled by that section's heading id
 * (aria-labelledby), and the heading itself plus any loading/error/empty
 * notice is role="presentation" — never in option position. A single roving
 * `highlightedIndex` spans every group, so
 * ArrowDown/Up walks straight across a group boundary instead of stopping at
 * it. The composer never moves DOM focus into a row — it stays on the
 * textarea and drives the highlight via the imperative handle below
 * (moveHighlight/pickHighlighted), exactly the combobox-with-listbox-popup
 * pattern: the textarea's aria-activedescendant (KoiosPanel) points at
 * whichever row is highlighted. Rows are `tabIndex={-1}` on purpose — nothing
 * in here is ever a real Tab stop.
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { Ref, RefObject } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatNumber } from '@/lib/formatters'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { GroupLabel, Caption } from '@/components/ui/typography'
import { MENTION_CATEGORIES } from './koiosMentionCategories'
import type { MentionCategoryConfig } from './koiosMentionCategories'
import { isCategoryVisible } from './koiosMentionAccess'
import { useKoiosEntitySearch, MIN_QUERY_LENGTH } from './useKoiosEntitySearch'
import type { KoiosEntityHit } from './useKoiosEntitySearch'
import { useKoiosMultiEntitySearch } from './useKoiosMultiEntitySearch'
import { resolveScopedQuery } from './mentionScope'
import { entityIconEl } from './koiosEntityIcons'
import type { KoiosMentionCounts } from './useKoiosMentionCounts'
import type { TFn } from '@/types/koios'

// One flat, pickable row — built fresh every render in exact DOM order (scoped
// results, THEN each fan-out group's rows, THEN the category list) so the
// roving highlight is a plain array index, never a per-group counter.
interface MentionOption {
  key: string
  id: string
  onPick: () => void
}

// Imperative surface the composer drives while the menu is open (KoiosPanel's
// textarea keydown handler) — the menu owns its own highlight state, the
// composer only forwards keys and reads back whether they did anything.
export interface KoiosMentionMenuHandle {
  moveHighlight: (delta: 1 | -1) => boolean
  pickHighlighted: () => boolean
}

interface KoiosMentionMenuProps {
  query: string
  counts: KoiosMentionCounts
  activeCategoryId: string | null
  activeCategoryLabel: string | null
  onPickCategory: (category: MentionCategoryConfig, label: string) => void
  onPickEntity: (hit: KoiosEntityHit, categoryId: string) => void
  t: TFn
  locale?: string
  menuRef: RefObject<HTMLDivElement | null>
  // Reports the currently highlighted row's DOM id (or null) so the composer
  // can point the textarea's aria-activedescendant at it.
  onActiveOptionChange?: (id: string | null) => void
  // Reports whether this render actually PAINTS a listbox (KOIOS-SEARCH-FIX-2)
  // — the menu can return null below the char threshold or on a scoped query
  // matching no category, and the composer's aria-expanded/aria-controls must
  // never describe a menu that isn't in the DOM.
  onOpenChange?: (open: boolean) => void
}

// One search-result row — icon-in-circle (entityIconFor) + name/subtitle, shared
// shape for every fan-out group and the scoped category search. `highlighted`
// is the keyboard roving state; `hovered` is plain mouse state — either lights
// the row the same way, so a keyboard highlight never gets silently cleared by
// an unrelated mouseleave.
function EntityRow({ hit, refType, onPick, optionId, highlighted }: {
  hit: KoiosEntityHit; refType: string; onPick: () => void; optionId: string; highlighted: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const active = highlighted || hovered
  return (
    // A search-result LISTBOX OPTION, not a standalone action — role="option" +
    // aria-selected drive its own highlight styling, which none of Button's
    // static variants model; same "dropdown option row" exemption SearchSelect's
    // own option rows already document (herhaal-audit precedent). Block form:
    // style spans several lines.
    /* eslint-disable huisstijlLegacy/no-restricted-syntax */
    <button id={optionId} role="option" aria-selected={highlighted} tabIndex={-1}
      onClick={onPick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
        background: active ? 'var(--hover-bg)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 10, transition: 'background 0.1s' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}>
        {entityIconEl(refType, { size: 13 })}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.name}</div>
        {hit.subtitle && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.subtitle}</div>
        )}
      </div>
    </button>
    /* eslint-enable huisstijlLegacy/no-restricted-syntax */
  )
}

// One category-list row (the "@" picker's own categories, before a fan-out
// hit or a scope is chosen) — same option/highlight contract as EntityRow.
function CategoryRow({ label, desc, onPick, optionId, highlighted }: {
  label: string; desc?: string; onPick: () => void; optionId: string; highlighted: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const active = highlighted || hovered
  return (
    // A category-picker LISTBOX OPTION — same role="option"/aria-selected
    // exemption as EntityRow above. Block form: style spans several lines.
    /* eslint-disable huisstijlLegacy/no-restricted-syntax */
    <button id={optionId} role="option" aria-selected={highlighted} tabIndex={-1}
      onClick={onPick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
        background: active ? 'var(--hover-bg)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 10, transition: 'background 0.1s' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg,var(--color-primary-bg),var(--color-violet-bg))',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-text)' }}>@</span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
    </button>
    /* eslint-enable huisstijlLegacy/no-restricted-syntax */
  )
}

// See the file's top doc above for the two modes; wrapped in forwardRef below so the composer can imperatively drive keyboard navigation.
function KoiosMentionMenu({
  query, counts, activeCategoryId, activeCategoryLabel, onPickCategory, onPickEntity, t, locale, menuRef,
  onActiveOptionChange, onOpenChange,
}: KoiosMentionMenuProps, ref: Ref<KoiosMentionMenuHandle>) {
  const auth = useAuth()
  const q = query.trim()

  // Scoped mode: the tail still starts with the chosen category's label. Below
  // the same 2-char threshold as the default fan-out, the header shows (so the
  // user sees which category they're in) but the loading/empty/results rows
  // stay hidden — mirrors the fan-out being hidden outright below that
  // threshold, instead of a misleading "no results" for a 1-char query.
  const scopedQuery = resolveScopedQuery(query, activeCategoryLabel)
  const scoped = activeCategoryId != null && scopedQuery !== null
  const scopedReady = scoped && scopedQuery!.trim().length >= MIN_QUERY_LENGTH
  const scopedSearch = useKoiosEntitySearch(scoped ? activeCategoryId! : '', scopedReady ? scopedQuery! : '')
  const scopedConfig = scoped ? MENTION_CATEGORIES.find((c) => c.id === activeCategoryId)?.search : undefined

  // Default mode fan-out (KOIOS-MENTION-BREED-1): every VISIBLE category with
  // search wiring, queried in parallel — order follows MENTION_CATEGORIES'
  // own canonical order (Danny 13/7).
  const fanOutCategories = MENTION_CATEGORIES.filter((c) => c.search && isCategoryVisible(c, auth))
  const fanOutIds = fanOutCategories.map((c) => c.id)
  const defaultSearchActive = !scoped && q.length >= MIN_QUERY_LENGTH
  const { groups: multi, retry: retryFanOut } = useKoiosMultiEntitySearch(defaultSearchActive ? fanOutIds : [], defaultSearchActive ? q : '')
  const anyGroupLoading = fanOutCategories.some((c) => multi[c.id]?.loading)
  // "Empty" requires every visible group to have actually SETTLED (present,
  // not loading, not errored) with zero hits — a group that hasn't reported
  // in yet (still {} during the pre-debounce window) must never read as empty.
  const allGroupsEmpty = defaultSearchActive && !anyGroupLoading && fanOutCategories.length > 0
    && fanOutCategories.every((c) => multi[c.id] && !multi[c.id].loading && !multi[c.id].error && multi[c.id].results.length === 0)

  // Category list — access-filtered, then filtered by the typed query.
  const categories = scoped ? [] : MENTION_CATEGORIES
    .filter((c) => isCategoryVisible(c, auth))
    .map((c) => {
      const count = c.countKey ? counts[c.countKey as keyof KoiosMentionCounts] : undefined
      return {
        cfg: c,
        label: t(c.labelKey),
        desc: typeof count === 'number' ? `${formatNumber(count, locale)} ${t('koios.mention.total')}` : undefined,
      }
    })
    .filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()) || c.cfg.id.includes(q.toLowerCase()))

  // The FLAT option list, in exact render order — the single source both the
  // JSX below and the roving keyboard highlight read from. Deliberately NOT
  // memoized: every entry closes over the CURRENT onPickEntity/onPickCategory
  // props, so useImperativeHandle below must rebuild whenever a real input
  // changed — memoizing this on a derived key would risk a STALE closure
  // (e.g. picking with the pre-edit `input` text) on a keystroke that changes
  // composer state without yet changing the visible result set (mid-debounce).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above: intentionally a fresh array every render, never memoized
  const options: MentionOption[] = [
    ...(scopedConfig && scopedReady && !scopedSearch.loading && !scopedSearch.error
      ? scopedSearch.results.map((hit) => ({
          key: `scoped:${hit.id}`, id: `koios-mention-option-scoped-${hit.id}`,
          onPick: () => onPickEntity(hit, activeCategoryId!),
        }))
      : []),
    ...(!scoped && defaultSearchActive
      ? fanOutCategories.flatMap((c) => {
          const group = multi[c.id]
          if (!group || group.loading || group.error || group.results.length === 0) return []
          return group.results.map((hit) => ({
            key: `fanout:${c.id}:${hit.id}`, id: `koios-mention-option-${c.id}-${hit.id}`,
            onPick: () => onPickEntity(hit, c.id),
          }))
        })
      : []),
    ...(!scoped
      ? categories.map((c) => ({
          key: `cat:${c.cfg.id}`, id: `koios-mention-option-cat-${c.cfg.id}`,
          onPick: () => onPickCategory(c.cfg, c.label),
        }))
      : []),
  ]
  const optionIndex = new Map(options.map((o, i) => [o.key, i]))
  const optionsKey = options.map((o) => o.key).join('|')

  // Roving highlight, reset to the first row whenever the visible option SET
  // changes — render-time state adjustment (React's own recommended pattern
  // for "derived state that resets on a condition"), not an effect, so there
  // is never an extra frame where the old index still points at a row that no
  // longer exists (the empty-flash bug this same delivery introduced).
  const [highlightedIndex, setHighlightedIndex] = useState(() => (options.length > 0 ? 0 : -1))
  const [trackedOptionsKey, setTrackedOptionsKey] = useState(optionsKey)
  if (optionsKey !== trackedOptionsKey) {
    setTrackedOptionsKey(optionsKey)
    setHighlightedIndex(options.length > 0 ? 0 : -1)
  }

  // Report the highlighted row's id up so KoiosPanel can point the textarea's
  // aria-activedescendant at it — a real cross-component sync, hence an effect.
  const activeOption = highlightedIndex >= 0 ? options[highlightedIndex] : undefined
  // Reports the highlighted option id up so the composer can point aria-activedescendant at it.
  useEffect(() => {
    onActiveOptionChange?.(activeOption?.id ?? null)
  }, [activeOption?.id, onActiveOptionChange])

  // The composer's keydown handler drives navigation through this handle —
  // DOM focus never leaves the textarea (ARIA combobox-with-listbox-popup).
  useImperativeHandle(ref, () => ({
    moveHighlight: (delta) => {
      if (options.length === 0) return false
      setHighlightedIndex((prev) => {
        const base = prev < 0 ? 0 : prev
        return (base + delta + options.length) % options.length
      })
      return true
    },
    pickHighlighted: () => {
      if (highlightedIndex < 0) return false
      const opt = options[highlightedIndex]
      if (!opt) return false
      opt.onPick()
      return true
    },
  }), [options, highlightedIndex])

  // Whether this render actually paints a listbox — below the char threshold,
  // or a scoped query matching no category, there is nothing to show. Reported
  // up via an effect (not read straight off the return-null branch) so the
  // composer's aria-expanded/aria-controls/aria-activedescendant only ever
  // describe a menu that is truly in the DOM (KOIOS-SEARCH-FIX-2).
  const willRender = scoped || defaultSearchActive || categories.length > 0
  // Reports whether the menu is actually about to render, so the composer aria-expanded/-controls only ever describe a menu truly in the DOM.
  useEffect(() => {
    onOpenChange?.(willRender)
  }, [willRender, onOpenChange])

  if (!willRender) return null

  return (
    // HUISSTIJL-1: dropdown menu — z-popover ladder tier, shadow-float role
    // role="listbox": every pickable row below is role="option" (group
    // headings stay presentational); aria-activedescendant lives on the
    // textarea in KoiosPanel, not here.
    <div ref={menuRef} id="koios-mention-menu" data-testid="koios-mention-menu" role="listbox" aria-label={t('koios.addContext')}
      style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 6,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: 'var(--shadow-float)', overflow: 'hidden', zIndex: 'var(--z-popover)',
        maxHeight: 320, overflowY: 'auto' }}>

      {/* Scoped: live search inside the one chosen category. ARIA structure
          (KOIOS-SEARCH-FIX-2): the heading + loading/error/empty notices are
          role="presentation" (never role="option" position); the actual rows
          sit in their own role="group" labelled by the heading's id — a
          listbox's owned children must be option/group, never bare text. */}
      {scoped && (
        <div role="presentation">
          <GroupLabel id="koios-mention-group-scoped-heading" style={{ padding: '8px 12px 4px' }}>{activeCategoryLabel}</GroupLabel>
          {!scopedConfig && (
            <Caption as="div" style={{ padding: '6px 12px 10px' }}>{t('koios.mention.searchUnsupported')}</Caption>
          )}
          {scopedConfig && scopedReady && scopedSearch.loading && (
            <Caption as="div" style={{ padding: '6px 12px 10px' }}>{t('loading')}</Caption>
          )}
          {/* An honest per-category FAILURE, distinguishable from zero hits — never
              silently swallowed into "no results" (§3 four-state rule). */}
          {scopedConfig && scopedReady && !scopedSearch.loading && scopedSearch.error && (
            <ErrorBanner onRetry={scopedSearch.retry} retryLabel={t('error.retry')} style={{ margin: '2px 12px 10px', borderRadius: 8 }}>
              {t('koios.mention.searchError')}
            </ErrorBanner>
          )}
          {scopedConfig && scopedReady && !scopedSearch.loading && !scopedSearch.error && scopedSearch.results.length === 0 && (
            <Caption as="div" style={{ padding: '6px 12px 10px' }}>{t('noResults')}</Caption>
          )}
          {scopedConfig && scopedReady && !scopedSearch.loading && !scopedSearch.error && scopedSearch.results.length > 0 && (
            <div role="group" aria-labelledby="koios-mention-group-scoped-heading">
              {scopedSearch.results.map((hit) => {
                const idx = optionIndex.get(`scoped:${hit.id}`)
                const optId = idx !== undefined ? options[idx].id : `koios-mention-option-scoped-${hit.id}`
                return (
                  <EntityRow key={hit.id} hit={hit} refType={scopedConfig.refType} optionId={optId}
                    highlighted={idx !== undefined && idx === highlightedIndex} onPick={() => onPickEntity(hit, activeCategoryId!)} />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Default fan-out: one grouped, capped section per visible searchable
          category — a group only renders while loading, errored, or once it
          has hits, so a broad query doesn't paint a dozen empty "no results"
          sections. Same ARIA split as the scoped block: heading/notices are
          presentational, results sit in their own labelled role="group". */}
      {!scoped && defaultSearchActive && (
        <div>
          {fanOutCategories.map((c) => {
            const group = multi[c.id]
            if (!group) return null
            if (!group.loading && !group.error && group.results.length === 0) return null
            const headingId = `koios-mention-group-${c.id}-heading`
            return (
              <div key={c.id}>
                <GroupLabel id={headingId} style={{ padding: '8px 12px 4px' }}>{t(c.labelKey)}</GroupLabel>
                {group.loading && <Caption as="div" style={{ padding: '6px 12px 10px' }}>{t('loading')}</Caption>}
                {/* One category failing never sinks the others (its own AbortController) —
                    but it must show its OWN honest error, not vanish. */}
                {!group.loading && group.error && (
                  <ErrorBanner onRetry={retryFanOut} retryLabel={t('error.retry')} style={{ margin: '2px 12px 10px', borderRadius: 8 }}>
                    {t('koios.mention.searchError')}
                  </ErrorBanner>
                )}
                {!group.loading && !group.error && group.results.length > 0 && (
                  <div role="group" aria-labelledby={headingId}>
                    {group.results.map((hit) => {
                      const idx = optionIndex.get(`fanout:${c.id}:${hit.id}`)
                      const optId = idx !== undefined ? options[idx].id : `koios-mention-option-${c.id}-${hit.id}`
                      return (
                        <EntityRow key={hit.id} hit={hit} refType={c.search!.refType} optionId={optId}
                          highlighted={idx !== undefined && idx === highlightedIndex} onPick={() => onPickEntity(hit, c.id)} />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {allGroupsEmpty && <Caption as="div" style={{ padding: '6px 12px 10px' }}>{t('noResults')}</Caption>}
        </div>
      )}

      {/* Category list — real tenant totals stream in via `counts`. Same ARIA
          split: heading is presentational, the rows are a labelled group. */}
      {!scoped && categories.length > 0 && (
        <div>
          <GroupLabel id="koios-mention-group-categories-heading" style={{ padding: '8px 12px 4px' }}>{t('koios.addContext')}</GroupLabel>
          <div role="group" aria-labelledby="koios-mention-group-categories-heading">
            {categories.map((c) => {
              const idx = optionIndex.get(`cat:${c.cfg.id}`)
              const optId = idx !== undefined ? options[idx].id : `koios-mention-option-cat-${c.cfg.id}`
              return (
                <CategoryRow key={c.cfg.id} label={c.label} desc={c.desc} optionId={optId}
                  highlighted={idx !== undefined && idx === highlightedIndex} onPick={() => onPickCategory(c.cfg, c.label)} />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default forwardRef<KoiosMentionMenuHandle, KoiosMentionMenuProps>(KoiosMentionMenu)
