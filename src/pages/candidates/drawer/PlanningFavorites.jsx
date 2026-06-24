/**
 * PlanningFavorites — the "Voorkeur & blacklist" sub-tab: two cards (preferred
 * vs. do-not-schedule) listing the candidate's client/location/department
 * choices, each with a typeahead to add new entries. Favourite/blacklist state
 * and the add-input state are owned by PlanningPanel and passed in.
 */
import { useTranslation } from 'react-i18next'
import { Heart, X, Ban, Plus } from 'lucide-react'
import { FAV_SEARCH_DATA } from '../data/mocks'
import { sectionBlock, sectionTitle } from './constants'

export default function PlanningFavorites({
  favorites, setFavorites, blacklist, setBlacklist,
  favAddMode, setFavAddMode, favAddInput, setFavAddInput,
}) {
  const { t } = useTranslation('candidates')

  // The three entry kinds shown per card; cancel resets the add input.
  const TYPES = [
    { key: 'clients',    label: t('planning.client') },
    { key: 'locations',   label: t('planning.locationLabel') },
    { key: 'departments', label: t('planning.department') },
  ]
  const cancel = () => { setFavAddMode(null); setFavAddInput('') }

  // The two cards: preference (favourite) and do-not-schedule (blacklist).
  const cards = [
    { mode: 'fav', icon: <Heart size={14} color="var(--color-danger)" fill="var(--color-danger)" />, title: t('planning.preference'),    emptyText: t('planning.noPreferences'),  data: favorites, setData: setFavorites },
    { mode: 'bl',  icon: <Ban   size={14} color="#EF4444" />,                                        title: t('planning.doNotSchedule'), emptyText: t('planning.noRestrictions'), data: blacklist,  setData: setBlacklist  },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {cards.map(({ mode, icon, title, emptyText, data, setData }) => {
        const isAdding = favAddMode === mode
        const allItems = TYPES.flatMap(({ key }) => data[key].map((item, j) => ({ key, item, j })))

        // Grouped typeahead results, excluding already-added values.
        const searchResults = isAdding && favAddInput.trim().length > 0
          ? FAV_SEARCH_DATA.map(({ type, label, items }) => ({
              type, label,
              matches: items.filter(v =>
                v.toLowerCase().includes(favAddInput.toLowerCase()) &&
                !data[type].includes(v)
              ),
            })).filter(g => g.matches.length > 0)
          : []

        const handleSelect = (type, item) => {
          setData(f => ({ ...f, [type]: [...f[type], item] }))
          setFavAddInput('')
          setFavAddMode(null)
        }

        return (
          <div key={mode} style={sectionBlock}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              {icon}
              <span style={{ ...sectionTitle, marginBottom: 0, flex: 1 }}>{title}</span>
              {!isAdding && (
                <button onClick={() => { setFavAddMode(mode); setFavAddInput('') }}
                  style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <Plus size={13} />
                </button>
              )}
            </div>

            {/* Flat list */}
            {allItems.length === 0 && !isAdding && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{emptyText}</div>
            )}
            {allItems.map(({ key, item, j }) => (
              <div key={`${key}-${j}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'var(--bg)',
                  color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600, flexShrink: 0 }}>
                  {TYPES.find(ty => ty.key === key)?.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{item}</span>
                <button onClick={() => setData(f => ({ ...f, [key]: f[key].filter((_, i) => i !== j) }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                  <X size={12} />
                </button>
              </div>
            ))}

            {/* Search input + dropdown */}
            {isAdding && (
              <div style={{ marginTop: allItems.length ? 10 : 0, position: 'relative' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input autoFocus value={favAddInput} onChange={e => setFavAddInput(e.target.value)}
                    onBlur={() => setTimeout(cancel, 180)}
                    onKeyDown={e => { if (e.key === 'Escape') cancel() }}
                    placeholder={t('planning.searchFav')}
                    style={{ flex: 1, padding: '5px 9px', fontSize: 12, border: '1px solid var(--color-primary)',
                      borderRadius: 6, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
                  <button onMouseDown={e => { e.preventDefault(); cancel() }}
                    style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, background: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <X size={11} />
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                    {searchResults.map(({ type, label, matches }) => (
                      <div key={type}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '6px 12px 3px',
                          textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg)',
                          borderBottom: '1px solid var(--border)' }}>
                          {label}s
                        </div>
                        {matches.map(item => (
                          <div key={item}
                            onMouseDown={e => { e.preventDefault(); handleSelect(type, item) }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text)',
                              borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg)',
                              color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600, flexShrink: 0 }}>
                              {label}
                            </span>
                            {item}
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
