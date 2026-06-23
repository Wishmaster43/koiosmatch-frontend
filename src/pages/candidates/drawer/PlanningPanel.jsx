import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Clock, MapPin, Heart, X, Check, Ban, Plus } from 'lucide-react'
import { DUMMY_SHIFTS_LIST, FAV_SEARCH_DATA, DUMMY_OPEN_SHIFTS } from '../data/mocks'
import { FUNCTION_LEVELS, sectionBlock, sectionTitle } from './constants'
import AvailabilityCalendar from './AvailabilityCalendar'
import PlanningTab from './PlanningTab'

/** Planning panel — availability / scheduling / open shifts / roles&pools /
 * favourite&blacklist. Owns all (dummy) planning state. */
export default function PlanningPanel({ c }) {
  const { t } = useTranslation('candidates')
  const [planningSubTab,       setPlanningSubTab]       = useState('availability')
  const [scheduleSelected,   setScheduleSelected]   = useState(null)
  const [scheduleFavorites, setScheduleFavorites] = useState({})
  const [scheduledIds,   setScheduledIds]   = useState(() => new Set())
  const [unscheduledIdx,  setUnscheduledIdx]  = useState(() => new Set())
  const [openFilters,    setOpenFilters]    = useState({ shiftTypes: ['Dag', 'Avond'], distance: 35, max_level: 5 })
  const [favorites,     setFavorites]     = useState({ clients: ['Thuiszorg Noord'], locations: ['Amsterdam'], departments: [] })
  const [blacklist,      setBlacklist]      = useState({ clients: [], locations: [], departments: [] })
  const [favAddMode,     setFavAddMode]     = useState(null)
  const [favAddInput,    setFavAddInput]    = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Planning sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 4, overflowX: 'auto' }}>
        {[
          { id: 'availability', label: t('planning.availability') },
          { id: 'scheduling',      label: t('planning.scheduling') },
          { id: 'openShifts',   label: t('planning.openShifts') },
          { id: 'roles',        label: t('planning.rolesPools') },
          { id: 'favorites',      label: t('planning.favBlacklist') },
        ].map(sub => (
          <button key={sub.id} onClick={() => { setPlanningSubTab(sub.id); setScheduleSelected(null) }}
            style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap', background: 'none', border: 'none',
              borderBottom: planningSubTab === sub.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: planningSubTab === sub.id ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: planningSubTab === sub.id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
            {sub.label}
          </button>
        ))}
      </div>

      {/* ── Availability ── */}
      {planningSubTab === 'availability' && <AvailabilityCalendar />}

      {/* ── Scheduling ── */}
      {planningSubTab === 'scheduling' && (() => {
        const visibleBase  = DUMMY_SHIFTS_LIST.filter((_, i) => !unscheduledIdx.has(i))
        const extraScheduled = DUMMY_OPEN_SHIFTS.filter(d => scheduledIds.has(d.id)).map(d => ({
          date: d.date, time: d.time, client: d.client, function: d.function,
          location: d.location, color: d.color, workedBefore: 0, favorite: false,
          address: '-', remarks: 'Ingepland via open diensten.', _openId: d.id,
        }))
        const allShifts = [...visibleBase, ...extraScheduled]
        const rosterBody  = allShifts.map(d => `${d.date}\t${d.time}\t${d.client}\t${d.location}`).join('%0A')
        const firstName    = c?.name?.split(' ')[0] ?? ''
        const mailHref    = `mailto:${c?.email ?? ''}?subject=Jouw%20rooster&body=Hallo%20${encodeURIComponent(firstName)}%2C%0A%0AHierbij%20je%20rooster%3A%0A%0A${rosterBody}%0A%0AMet%20vriendelijke%20groet`
        return (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {/* List */}
            <div style={{ ...sectionBlock, flex: scheduleSelected ? '0 0 265px' : '1', minWidth: 0, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={sectionTitle}>{t('planning.roster')} ({allShifts.length})</span>
                <a href={mailHref} title={t('planning.mail')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500,
                    border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)',
                    textDecoration: 'none', cursor: 'pointer' }}>
                  <Mail size={11} /> {t('planning.mail')}
                </a>
              </div>
              {allShifts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>{t('planning.noScheduled')}</div>
              )}
              {allShifts.map((d, i) => {
                const isSel = scheduleSelected === d
                return (
                  <div key={i} onClick={() => setScheduleSelected(isSel ? null : d)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 8px', borderRadius: 7, marginBottom: 2, cursor: 'pointer',
                      background: isSel ? 'var(--bg)' : 'transparent',
                      border: isSel ? `1px solid ${d.color}` : '1px solid transparent' }}>
                    <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: d.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{d.date}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                          <Clock size={9} />{d.time}
                        </span>
                        {d._openId && <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: '#DCFCE7', color: '#16A34A', fontWeight: 600 }}>{t('planning.new')}</span>}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client}</div>
                      {!scheduleSelected && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.function}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                            <MapPin size={9} />{d.location}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Detail panel */}
            {scheduleSelected && (() => {
              const d = scheduleSelected
              const fav = scheduleFavorites[d.date + d.client] ?? d.favorite
              const toggleFav = () => setScheduleFavorites(p => ({ ...p, [d.date + d.client]: !fav }))
              const baseIdx = DUMMY_SHIFTS_LIST.indexOf(d)
              const handleUnschedule = () => {
                if (d._openId) {
                  setScheduledIds(prev => { const n = new Set(prev); n.delete(d._openId); return n })
                } else if (baseIdx !== -1) {
                  setUnscheduledIdx(prev => { const n = new Set(prev); n.add(baseIdx); return n })
                }
                setScheduleSelected(null)
              }
              return (
                <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 3, height: 38, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.client}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.function}</div>
                    </div>
                    <button onClick={toggleFav} title={fav ? t('planning.removeFavorite') : t('planning.favorite')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: fav ? 'var(--color-danger)' : 'var(--text-muted)', display: 'flex' }}>
                      <Heart size={15} fill={fav ? 'var(--color-danger)' : 'none'} />
                    </button>
                    <button onClick={() => setScheduleSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                  {[
                    [t('planning.date'),         d.date],
                    [t('planning.time'),         d.time],
                    [t('planning.location'),     d.location],
                    [t('planning.address'),      d.address ?? '-'],
                    [t('planning.workedBefore'), d.workedBefore > 0 ? t('planning.workedBeforeYes', { count: d.workedBefore, client: d.client }) : t('planning.workedBeforeNo', { client: d.client })],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', padding: '8px 14px', borderBottom: '1px solid var(--border)', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>{l}</span>
                      <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                  {d.workedBefore > 0 && (
                    <div style={{ padding: '7px 14px', background: 'var(--color-success-bg)', borderBottom: '1px solid var(--color-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={11} color="var(--color-success)" />
                      <span style={{ fontSize: 11, color: '#15803D', fontWeight: 500 }}>{t('planning.knownShort')}</span>
                    </div>
                  )}
                  {d.remarks ? (
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('planning.remarks')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>{d.remarks}</div>
                    </div>
                  ) : null}
                  <div style={{ padding: '10px 14px' }}>
                    <button onClick={handleUnschedule}
                      style={{ width: '100%', padding: '7px 0', fontSize: 12, fontWeight: 600, borderRadius: 7, cursor: 'pointer',
                        border: '1px solid var(--color-danger)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                      {t('planning.unschedule')}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── Open shifts ── */}
      {planningSubTab === 'openShifts' && (() => {
        const candLevel = openFilters.max_level
        const filtered = DUMMY_OPEN_SHIFTS.filter(d =>
          d.distance <= openFilters.distance &&
          d.level <= candLevel &&
          (openFilters.shiftTypes.length === 0 || openFilters.shiftTypes.includes(d.shiftType))
        )
        const toggleDiensttype = (dt) => setOpenFilters(f => {
          const has = f.shiftTypes.includes(dt)
          return { ...f, shiftTypes: has ? f.shiftTypes.filter(x => x !== dt) : [...f.shiftTypes, dt] }
        })
        const toggleScheduled = (id) => setScheduledIds(prev => {
          const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n
        })
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Filter bar */}
            <div style={{ ...sectionBlock, padding: '12px 16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>{t('planning.shiftType')}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['Dag', 'day'], ['Avond', 'evening'], ['Nacht', 'night']].map(([dt, key]) => {
                      const active = openFilters.shiftTypes.includes(dt)
                      return (
                        <button key={dt} onClick={() => toggleDiensttype(dt)}
                          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: active ? 600 : 400,
                            border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                            background: active ? 'var(--color-primary)' : 'var(--bg)',
                            color: active ? '#fff' : 'var(--text-muted)' }}>
                          {t(`planning.${key}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>{t('planning.maxDistance')}</div>
                  <select value={openFilters.distance} onChange={e => setOpenFilters(f => ({ ...f, distance: Number(e.target.value) }))}
                    style={{ padding: '5px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
                    {[10, 25, 35, 50, 999].map(v => <option key={v} value={v}>{v === 999 ? t('planning.noLimit') : `${v} km`}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>{t('planning.maxLevel')}</div>
                  <select value={openFilters.max_level} onChange={e => setOpenFilters(f => ({ ...f, max_level: Number(e.target.value) }))}
                    style={{ padding: '5px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
                    {FUNCTION_LEVELS.map((fn, i) => <option key={fn} value={i + 1}>{fn}</option>)}
                  </select>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {filtered.length}/{DUMMY_OPEN_SHIFTS.length} {t('planning.shifts')}
                  </span>
                </div>
              </div>
            </div>
            {/* Results */}
            <div style={sectionBlock}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  {t('planning.noOpenShifts')}
                </div>
              ) : filtered.map((d, i) => {
                const isScheduled   = scheduledIds.has(d.id)
                const isFavCustomer  = favorites.clients.includes(d.client)
                const isBlockedCustomer   = blacklist.clients.includes(d.client)
                const isBlockedLocation = blacklist.locations.includes(d.location)
                const tags = [
                  { label: `${d.distance} km`, ok: d.distance <= 35 },
                  { label: d.shiftType, ok: openFilters.shiftTypes.includes(d.shiftType) },
                  d.level < 5 && { label: d.function, ok: true },
                ].filter(Boolean)
                return (
                  <div key={d.id} style={{ padding: '10px 0', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    opacity: isBlockedCustomer || isBlockedLocation ? 0.4 : 1 }}>
                    <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: d.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{d.client}</span>
                        {isFavCustomer && <Heart size={11} color="var(--color-danger)" fill="var(--color-danger)" />}
                        {isBlockedCustomer  && <Ban size={11} color="#EF4444" />}
                        {d.openSpots === 1 && (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#FEF3C7', color: '#D97706', fontWeight: 600 }}>{t('planning.lastSpot')}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
                        {d.date} · {d.time} · {d.location} · {d.pool}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {tags.map((tag, j) => (
                          <span key={j} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99,
                            background: tag.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                            color: tag.ok ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 500 }}>
                            {tag.ok ? '✓' : '✗'} {tag.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => toggleScheduled(d.id)} disabled={isBlockedCustomer || isBlockedLocation}
                      style={{ flexShrink: 0, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7,
                        cursor: isBlockedCustomer || isBlockedLocation ? 'not-allowed' : 'pointer', minWidth: 90,
                        border: isScheduled ? '1px solid var(--color-success)' : '1px solid var(--color-primary)',
                        background: isScheduled ? 'var(--color-success-bg)' : 'var(--color-primary)',
                        color: isScheduled ? 'var(--color-success)' : 'white' }}>
                      {isScheduled ? `✓ ${t('planning.scheduled')}` : t('planning.schedule')}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Roles & Pools ── */}
      {planningSubTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PlanningTab c={c} />
        </div>
      )}

      {/* ── Favourite & Blacklist ── */}
      {planningSubTab === 'favorites' && (() => {
        const TYPES = [
          { key: 'clients',    label: t('planning.client') },
          { key: 'locations',   label: t('planning.locationLabel') },
          { key: 'departments', label: t('planning.department') },
        ]
        const cancel = () => { setFavAddMode(null); setFavAddInput('') }

        const cards = [
          { mode: 'fav', icon: <Heart size={14} color="var(--color-danger)" fill="var(--color-danger)" />, title: t('planning.preference'),    emptyText: t('planning.noPreferences'),  data: favorites, setData: setFavorites },
          { mode: 'bl',  icon: <Ban   size={14} color="#EF4444" />,                                        title: t('planning.doNotSchedule'), emptyText: t('planning.noRestrictions'), data: blacklist,  setData: setBlacklist  },
        ]

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {cards.map(({ mode, icon, title, emptyText, data, setData }) => {
              const isAdding = favAddMode === mode
              const allItems = TYPES.flatMap(({ key }) => data[key].map((item, j) => ({ key, item, j })))

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
      })()}
    </div>
  )
}
