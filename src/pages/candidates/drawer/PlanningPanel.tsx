import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import AvailabilityEditor from './AvailabilityEditor'
import PlanningTab from './PlanningTab'
import PlanningScheduling from './PlanningScheduling'
import PlanningOpenShifts from './PlanningOpenShifts'
import PlanningFavorites from './PlanningFavorites'
import { useCandidatePlanningPreferences, usePlanningPreferenceTargets, namesByType } from '../hooks/useCandidatePlanning'
import { useCandidateSchedule } from '../hooks/useCandidateSchedule'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'
import type { OpenFilters, RosterShift, ScheduleFavorites } from './planningTypes'

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

  // Real planning preferences (favourite + blacklist) for this candidate. The open-shifts
  // tab only needs the grouped NAME lists to dim/flag rows, so derive those via namesByType.
  const prefs = useCandidatePlanningPreferences(c.id)
  const { groups: prefTargets } = usePlanningPreferenceTargets()
  // Real agenda + open shifts (G-7 — replaces the dummy roster/open-shift datasets).
  const { roster, openShifts } = useCandidateSchedule(c.id)
  const favoriteNames  = namesByType(prefs.favorites)
  const blacklistNames = namesByType(prefs.blacklist)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Planning sub-tabs — shared SubTabBar (one look for every drawer sub-tab strip). */}
      <SubTabBar
        tabs={[
          { id: 'availability', label: t('planning.availability') },
          { id: 'scheduling',   label: t('planning.scheduling') },
          { id: 'openShifts',   label: t('planning.openShifts') },
          { id: 'roles',        label: t('planning.rolesPools') },
          { id: 'favorites',    label: t('planning.favBlacklist') },
        ]}
        active={planningSubTab}
        onChange={(id) => { setPlanningSubTab(id); setScheduleSelected(null) }}
      />

      {/* Each sub-tab routes to its own component; state stays here. */}
      {planningSubTab === 'availability' && <AvailabilityEditor candidateId={c.id} />}

      {planningSubTab === 'scheduling' && (
        <PlanningScheduling c={c} baseShifts={roster} openShifts={openShifts}
          scheduleSelected={scheduleSelected} setScheduleSelected={setScheduleSelected}
          scheduleFavorites={scheduleFavorites} setScheduleFavorites={setScheduleFavorites}
          scheduledIds={scheduledIds} setScheduledIds={setScheduledIds}
          unscheduledIdx={unscheduledIdx} setUnscheduledIdx={setUnscheduledIdx} />
      )}

      {planningSubTab === 'openShifts' && (
        <PlanningOpenShifts openShifts={openShifts}
          openFilters={openFilters} setOpenFilters={setOpenFilters}
          scheduledIds={scheduledIds} setScheduledIds={setScheduledIds}
          favorites={favoriteNames} blacklist={blacklistNames} />
      )}

      {planningSubTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PlanningTab c={c} />
        </div>
      )}

      {planningSubTab === 'favorites' && (
        <PlanningFavorites
          favorites={prefs.favorites} blacklist={prefs.blacklist}
          targets={prefTargets} loading={prefs.loading}
          onAdd={prefs.add} onRemove={prefs.remove} />
      )}
    </div>
  )
}
