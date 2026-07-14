/**
 * KoiosMentionMenu — the "@" picker floated above the composer: a live
 * candidate-search section (from 2 typed characters, Danny 13/7) above the
 * fixed category list. Categories carry REAL tenant counts (useKoiosMentionCounts,
 * streamed in — never blocking) instead of the old hardcoded demo numbers.
 * Picking a candidate hands back the hit (KoiosPanel records a context ref +
 * chip); picking a category keeps the original "insert @Label" behaviour.
 */
import type { RefObject } from 'react'
import { formatNumber } from '@/lib/formatters'
import Avatar from '@/components/ui/Avatar'
import { MENTION_CATEGORIES } from './koiosMentionCategories'
import { useKoiosCandidateSearch } from './useKoiosCandidateSearch'
import type { KoiosCandidateHit } from './useKoiosCandidateSearch'
import type { KoiosMentionCounts } from './useKoiosMentionCounts'
import type { TFn } from '@/types/koios'

const MIN_SEARCH_LENGTH = 2

interface KoiosMentionMenuProps {
  query: string
  counts: KoiosMentionCounts
  onPickCategory: (label: string) => void
  onPickCandidate: (hit: KoiosCandidateHit) => void
  t: TFn
  locale?: string
  menuRef: RefObject<HTMLDivElement | null>
}

export default function KoiosMentionMenu({
  query, counts, onPickCategory, onPickCandidate, t, locale, menuRef,
}: KoiosMentionMenuProps) {
  const q = query.trim()
  const searchActive = q.length >= MIN_SEARCH_LENGTH
  // Hook is always called (rules-of-hooks); an empty query short-circuits inside it.
  const { results, loading } = useKoiosCandidateSearch(searchActive ? q : '')

  // Category list filtered by the typed query (label or id substring match);
  // desc = the real tenant total once it has streamed in, else no desc line.
  const categories = MENTION_CATEGORIES
    .map((c) => {
      const count = c.countKey ? counts[c.countKey as keyof KoiosMentionCounts] : undefined
      return {
        id: c.id,
        label: t(c.labelKey),
        desc: typeof count === 'number' ? `${formatNumber(count, locale)} ${t('koios.mention.total')}` : undefined,
      }
    })
    .filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()) || c.id.includes(q.toLowerCase()))

  // Nothing to show at all — hide the floating panel entirely (mirrors the
  // previous "filteredMentions.length > 0" gate).
  if (!searchActive && categories.length === 0) return null

  return (
    <div ref={menuRef} data-testid="koios-mention-menu"
      style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 6,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 50,
        maxHeight: 320, overflowY: 'auto' }}>

      {/* Live candidate results — real records, not a category (Danny 13/7). */}
      {searchActive && (
        <div>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('nav.candidates')}
          </div>
          {loading && (
            <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{t('loading')}</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{t('noResults')}</div>
          )}
          {!loading && results.map((hit) => (
            <button key={hit.id} onClick={() => onPickCandidate(hit)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
              <Avatar initials={hit.initials} size={26} soft />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.name}</div>
                {hit.title && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.title}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Category list — real tenant totals stream in via `counts`. */}
      {categories.length > 0 && (
        <div>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('koios.addContext')}
          </div>
          {categories.map((c) => (
            <button key={c.id} onClick={() => onPickCategory(c.label)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg,var(--color-primary-bg),#F3E8FF)',
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
