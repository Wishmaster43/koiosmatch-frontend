/**
 * PlanningScheduling — the "Inroostering" sub-tab of the candidate planning
 * panel: the candidate's roster list (incl. shifts added from open shifts) with
 * a mail-roster action, and a detail panel per shift (favourite + unschedule).
 * All planning state is owned by PlanningPanel and passed in.
 */
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Clock, MapPin, Heart, X, Check } from 'lucide-react'
import { DUMMY_SHIFTS_LIST, DUMMY_OPEN_SHIFTS } from '../data/mocks'
import { sectionBlock, sectionTitle } from './constants'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'
import type { OpenShift, RosterShift, ScheduleFavorites } from './planningTypes'

interface PlanningSchedulingProps {
  c: Candidate
  scheduleSelected: RosterShift | null
  setScheduleSelected: Dispatch<SetStateAction<RosterShift | null>>
  scheduleFavorites: ScheduleFavorites
  setScheduleFavorites: Dispatch<SetStateAction<ScheduleFavorites>>
  scheduledIds: Set<Id>
  setScheduledIds: Dispatch<SetStateAction<Set<Id>>>
  unscheduledIdx: Set<number>
  setUnscheduledIdx: Dispatch<SetStateAction<Set<number>>>
}

const BASE_SHIFTS = DUMMY_SHIFTS_LIST as unknown as RosterShift[]
const OPEN_SHIFTS = DUMMY_OPEN_SHIFTS as unknown as OpenShift[]

export default function PlanningScheduling({
  c, scheduleSelected, setScheduleSelected, scheduleFavorites, setScheduleFavorites,
  scheduledIds, setScheduledIds, unscheduledIdx, setUnscheduledIdx,
}: PlanningSchedulingProps) {
  const { t } = useTranslation('candidates')

  // Build the roster: base shifts minus unscheduled ones, plus shifts picked from open shifts.
  const visibleBase = BASE_SHIFTS.filter((_, i) => !unscheduledIdx.has(i))
  const extraScheduled: RosterShift[] = OPEN_SHIFTS.filter(d => scheduledIds.has(d.id)).map(d => ({
    date: d.date, time: d.time, client: d.client, function: d.function,
    location: d.location, color: d.color, workedBefore: 0, favorite: false,
    address: '-', remarks: 'Ingepland via open diensten.', _openId: d.id,
  }))
  const allShifts: RosterShift[] = [...visibleBase, ...extraScheduled]
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
        const baseIdx = BASE_SHIFTS.indexOf(d)
        // Remove this shift from the roster (open-shift pick vs. base shift differ).
        const handleUnschedule = () => {
          const openId = d._openId
          if (openId != null) {
            setScheduledIds(prev => { const n = new Set(prev); n.delete(openId); return n })
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
}
