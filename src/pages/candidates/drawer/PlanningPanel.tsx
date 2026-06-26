import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AvailabilityCalendar from './AvailabilityCalendar'
import PlanningTab from './PlanningTab'
import PlanningScheduling from './PlanningScheduling'
import PlanningOpenShifts from './PlanningOpenShifts'
import PlanningFavorites from './PlanningFavorites'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'
import type { FavLists, OpenFilters, RosterShift, ScheduleFavorites } from './planningTypes'

/** Planning panel — thin container: owns all (dummy) planning state and routes
 * each sub-tab (availability / scheduling / open shifts / roles & pools /
 * favourite & blacklist) to its own component. */
export default function PlanningPanel({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const [planningSubTab,    setPlanningSubTab]    = useState('availability')
  const [scheduleSelected,  setScheduleSelected]  = useState<RosterShift | null>(null)
  const [scheduleFavorites, setScheduleFavorites] = useState<ScheduleFavorites>({})
  const [scheduledIds,      setScheduledIds]      = useState(() => new Set<Id>())
  const [unscheduledIdx,    setUnscheduledIdx]    = useState(() => new Set<number>())
  const [openFilters,       setOpenFilters]       = useState<OpenFilters>({ shiftTypes: ['Dag', 'Avond'], distance: 35, max_level: 5 })
  const [favorites,         setFavorites]         = useState<FavLists>({ clients: ['Thuiszorg Noord'], locations: ['Amsterdam'], departments: [] })
  const [blacklist,         setBlacklist]         = useState<FavLists>({ clients: [], locations: [], departments: [] })
  const [favAddMode,        setFavAddMode]        = useState<string | null>(null)
  const [favAddInput,       setFavAddInput]       = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Planning sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 4, overflowX: 'auto' }}>
        {[
          { id: 'availability', label: t('planning.availability') },
          { id: 'scheduling',   label: t('planning.scheduling') },
          { id: 'openShifts',   label: t('planning.openShifts') },
          { id: 'roles',        label: t('planning.rolesPools') },
          { id: 'favorites',    label: t('planning.favBlacklist') },
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

      {/* Each sub-tab routes to its own component; state stays here. */}
      {planningSubTab === 'availability' && <AvailabilityCalendar />}

      {planningSubTab === 'scheduling' && (
        <PlanningScheduling c={c}
          scheduleSelected={scheduleSelected} setScheduleSelected={setScheduleSelected}
          scheduleFavorites={scheduleFavorites} setScheduleFavorites={setScheduleFavorites}
          scheduledIds={scheduledIds} setScheduledIds={setScheduledIds}
          unscheduledIdx={unscheduledIdx} setUnscheduledIdx={setUnscheduledIdx} />
      )}

      {planningSubTab === 'openShifts' && (
        <PlanningOpenShifts
          openFilters={openFilters} setOpenFilters={setOpenFilters}
          scheduledIds={scheduledIds} setScheduledIds={setScheduledIds}
          favorites={favorites} blacklist={blacklist} />
      )}

      {planningSubTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PlanningTab c={c} />
        </div>
      )}

      {planningSubTab === 'favorites' && (
        <PlanningFavorites
          favorites={favorites} setFavorites={setFavorites}
          blacklist={blacklist} setBlacklist={setBlacklist}
          favAddMode={favAddMode} setFavAddMode={setFavAddMode}
          favAddInput={favAddInput} setFavAddInput={setFavAddInput} />
      )}
    </div>
  )
}
