/**
 * KoiosMentionMenu — the "@" picker floated above the composer. Two modes:
 *  - default (no category chosen yet): a live CANDIDATE quick-search (from 2
 *    typed characters, unchanged Danny 13/7 behaviour) above the category list.
 *  - scoped (a category was clicked): the category list is replaced by a live
 *    search WITHIN that one category (KOIOS-SEARCH-1, useKoiosEntitySearch),
 *    e.g. "@Vacatures verpl" searches vacancies for "verpl". mentionScope.ts
 *    decides when the typed tail still belongs to the chosen category.
 * Categories the user lacks access to (koiosMentionAccess) are hidden outright.
 * Picking any row hands the hit back to KoiosPanel, which records a context ref
 * + chip (candidate today; every other type client-side-only, see
 * koiosContextTypes.ts).
 */
import type { RefObject } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatNumber } from '@/lib/formatters'
import { MENTION_CATEGORIES } from './koiosMentionCategories'
import type { MentionCategoryConfig } from './koiosMentionCategories'
import { isCategoryVisible } from './koiosMentionAccess'
import { useKoiosEntitySearch } from './useKoiosEntitySearch'
import type { KoiosEntityHit } from './useKoiosEntitySearch'
import { resolveScopedQuery } from './mentionScope'
import { entityIconEl } from './koiosEntityIcons'
import type { KoiosMentionCounts } from './useKoiosMentionCounts'
import type { TFn } from '@/types/koios'

const MIN_SEARCH_LENGTH = 2

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
}

// One search-result row — icon-in-circle (entityIconFor) + name/subtitle, shared
// shape for the default candidate quick-search and every scoped category search.
function EntityRow({ hit, refType, onPick }: { hit: KoiosEntityHit; refType: string; onPick: () => void }) {
  return (
    <button onClick={onPick}
      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
        background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 10, transition: 'background 0.1s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
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
  )
}

export default function KoiosMentionMenu({
  query, counts, activeCategoryId, activeCategoryLabel, onPickCategory, onPickEntity, t, locale, menuRef,
}: KoiosMentionMenuProps) {
  const auth = useAuth()
  const q = query.trim()

  // Scoped mode: the tail still starts with the chosen category's label. Below
  // the same 2-char threshold as the default candidate search, the header shows
  // (so the user sees which category they're in) but the loading/empty/results
  // rows stay hidden — mirrors the default section being hidden outright below
  // that threshold, instead of a misleading "no results" for a 1-char query.
  const scopedQuery = resolveScopedQuery(query, activeCategoryLabel)
  const scoped = activeCategoryId != null && scopedQuery !== null
  const scopedReady = scoped && scopedQuery!.trim().length >= MIN_SEARCH_LENGTH
  const scopedSearch = useKoiosEntitySearch(scoped ? activeCategoryId! : '', scopedReady ? scopedQuery! : '')
  const scopedConfig = scoped ? MENTION_CATEGORIES.find((c) => c.id === activeCategoryId)?.search : undefined

  // Default mode: the candidate quick-search (unchanged) above the category list.
  const defaultSearchActive = !scoped && q.length >= MIN_SEARCH_LENGTH
  const defaultSearch = useKoiosEntitySearch('candidates', defaultSearchActive ? q : '')

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

  if (!scoped && !defaultSearchActive && categories.length === 0) return null

  return (
    <div ref={menuRef} data-testid="koios-mention-menu"
      style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 6,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 50,
        maxHeight: 320, overflowY: 'auto' }}>

      {/* Scoped: live search inside the one chosen category. */}
      {scoped && (
        <div>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {activeCategoryLabel}
          </div>
          {!scopedConfig && (
            <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
              {t('koios.mention.searchUnsupported')}
            </div>
          )}
          {scopedConfig && scopedReady && scopedSearch.loading && (
            <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{t('loading')}</div>
          )}
          {scopedConfig && scopedReady && !scopedSearch.loading && scopedSearch.results.length === 0 && (
            <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{t('noResults')}</div>
          )}
          {scopedConfig && scopedReady && !scopedSearch.loading && scopedSearch.results.map((hit) => (
            <EntityRow key={hit.id} hit={hit} refType={scopedConfig.refType}
              onPick={() => onPickEntity(hit, activeCategoryId!)} />
          ))}
        </div>
      )}

      {/* Default: candidate quick search, unchanged. */}
      {!scoped && defaultSearchActive && (
        <div>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('nav.candidates')}
          </div>
          {defaultSearch.loading && (
            <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{t('loading')}</div>
          )}
          {!defaultSearch.loading && defaultSearch.results.length === 0 && (
            <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{t('noResults')}</div>
          )}
          {!defaultSearch.loading && defaultSearch.results.map((hit) => (
            <EntityRow key={hit.id} hit={hit} refType="candidate" onPick={() => onPickEntity(hit, 'candidates')} />
          ))}
        </div>
      )}

      {/* Category list — real tenant totals stream in via `counts`. */}
      {!scoped && categories.length > 0 && (
        <div>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('koios.addContext')}
          </div>
          {categories.map((c) => (
            <button key={c.cfg.id} onClick={() => onPickCategory(c.cfg, c.label)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg,var(--color-primary-bg),var(--color-violet-bg))',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>@</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.label}</div>
                {c.desc && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.desc}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
