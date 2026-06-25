/**
 * PlanningOpenShifts — the "Open diensten" sub-tab: a filter bar (shift type /
 * max distance / max level) over the open-shift list, each row showing fit tags
 * and a schedule toggle. Blocked customers/locations are dimmed and disabled.
 * Filter + scheduled-id state is owned by PlanningPanel and passed in.
 */
import { useTranslation } from 'react-i18next'
import { Heart, Ban } from 'lucide-react'
import { DUMMY_OPEN_SHIFTS } from '../data/mocks'
import { FUNCTION_LEVELS, sectionBlock } from './constants'

export default function PlanningOpenShifts({ openFilters, setOpenFilters, scheduledIds, setScheduledIds, favorites, blacklist }) {
  const { t } = useTranslation('candidates')

  // Filter open shifts by distance, candidate level and selected shift types.
  const candLevel = openFilters.max_level
  const filtered = DUMMY_OPEN_SHIFTS.filter(d =>
    d.distance <= openFilters.distance &&
    d.level <= candLevel &&
    (openFilters.shiftTypes.length === 0 || openFilters.shiftTypes.includes(d.shiftType))
  )
  const toggleShiftType = (dt) => setOpenFilters(f => {
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
                  <button key={dt} onClick={() => toggleShiftType(dt)}
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
}
