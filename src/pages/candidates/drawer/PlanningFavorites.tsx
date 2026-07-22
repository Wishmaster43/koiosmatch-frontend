/**
 * PlanningFavorites — the "Voorkeur & blacklist" sub-tab: two cards (preferred vs.
 * do-not-schedule) listing the candidate's customer/location/department planning
 * preferences. Data + mutations come from useCandidatePlanningPreferences (real
 * API: POST/DELETE); the add-typeahead searches real customers/locations/departments
 * and an optional reason is stored per entry.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, X, Ban, Plus } from 'lucide-react'
import { sectionBlock, sectionTitle } from './constants'
import type { Id } from '@/types/common'
import type { LinkableType, Preference, PrefKind, PrefTargetGroup } from '../hooks/useCandidatePlanning'

interface PlanningFavoritesProps {
  favorites: Preference[]
  blacklist: Preference[]
  targets: PrefTargetGroup[]
  onAdd: (kind: PrefKind, target: { linkable_type: LinkableType; linkable_id: Id; linkable_name: string; reason?: string }) => void
  onRemove: (prefId: Id) => void
  loading?: boolean
}

export default function PlanningFavorites({ favorites, blacklist, targets, onAdd, onRemove, loading }: PlanningFavoritesProps) {
  const { t } = useTranslation('candidates')
  // Which card is in add-mode ('favorite' | 'blacklist' | null) + its inputs.
  const [addMode, setAddMode] = useState<PrefKind | null>(null)
  const [query,   setQuery]   = useState('')
  const [reason,  setReason]  = useState('')

  // Badge label per linkable type.
  const typeLabel: Record<LinkableType, string> = {
    customer:   t('planning.client'),
    location:   t('planning.locationLabel'),
    department: t('planning.department'),
  }

  const cancel = () => { setAddMode(null); setQuery(''); setReason('') }

  // The two cards: preference (favourite) and do-not-schedule (blacklist).
  const cards: { kind: PrefKind; icon: ReactNode; title: string; emptyText: string; data: Preference[] }[] = [
    { kind: 'favorite',  icon: <Heart size={14} color="var(--color-danger)" fill="var(--color-danger)" />, title: t('planning.preference'),    emptyText: t('planning.noPreferences'),  data: favorites },
    { kind: 'blacklist', icon: <Ban size={14} color="var(--color-danger)" />,                              title: t('planning.doNotSchedule'), emptyText: t('planning.noRestrictions'), data: blacklist },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {cards.map(({ kind, icon, title, emptyText, data }) => {
        const isAdding = addMode === kind

        // Grouped typeahead results, excluding values already present in THIS card.
        const q = query.trim().toLowerCase()
        const results = isAdding && q.length > 0
          ? targets.map(g => ({
              linkable_type: g.linkable_type,
              items: g.items.filter(it =>
                it.name.toLowerCase().includes(q) &&
                !data.some(p => p.linkable_type === g.linkable_type && String(p.linkable_id) === String(it.id)),
              ).slice(0, 6),
            })).filter(g => g.items.length > 0)
          : []

        // Add the picked target with the current (optional) reason, then reset.
        const handleSelect = (linkable_type: LinkableType, id: Id, name: string) => {
          onAdd(kind, { linkable_type, linkable_id: id, linkable_name: name, reason: reason.trim() || undefined })
          cancel()
        }

        return (
          <div key={kind} style={sectionBlock}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              {icon}
              <span style={{ ...sectionTitle, marginBottom: 0, flex: 1 }}>{title}</span>
              {!isAdding && (
                <button onClick={() => { setAddMode(kind); setQuery(''); setReason('') }} aria-label={t('common:add')}
                  style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <Plus size={13} />
                </button>
              )}
            </div>

            {/* Four states: loading / empty / list (success) */}
            {loading && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('common:loading')}</div>}
            {!loading && data.length === 0 && !isAdding && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{emptyText}</div>
            )}
            {data.map(p => (
              <div key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'var(--bg)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', fontWeight: 600, flexShrink: 0 }}>
                  {typeLabel[p.linkable_type]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.linkable_name}</div>
                  {p.reason ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.reason}</div> : null}
                </div>
                <button onClick={() => onRemove(p.id)} aria-label={t('common:delete')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                  <X size={12} />
                </button>
              </div>
            ))}

            {/* Add row: search + optional reason + grouped results */}
            {isAdding && (
              <div style={{ marginTop: data.length ? 10 : 0, position: 'relative' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') cancel() }}
                    placeholder={t('planning.searchFav')}
                    style={{ flex: 1, padding: '5px 9px', fontSize: 12, border: '1px solid var(--color-primary)',
                      borderRadius: 6, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                  <button onClick={cancel} aria-label={t('common:cancel')}
                    style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, background: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <X size={11} />
                  </button>
                </div>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder={t('planning.reasonPlaceholder')}
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '5px 9px', fontSize: 12,
                    border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                {results.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                    {results.map(g => (
                      <div key={g.linkable_type}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '6px 12px 3px',
                          textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          {typeLabel[g.linkable_type]}
                        </div>
                        {g.items.map(it => (
                          <div key={String(it.id)} onClick={() => handleSelect(g.linkable_type, it.id, it.name)}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                            {it.name}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
