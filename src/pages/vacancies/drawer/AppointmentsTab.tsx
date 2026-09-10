/**
 * AppointmentsTab — see the fuller docblock below, right above the component,
 * for the vacancy-wide appointments list this tab renders and how its
 * create/edit flows reuse the shared PlanIntakeModal.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppointmentsList from '@/components/drawer/AppointmentsList'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
// Shared no-permission/loading/error gate + edit-modal wrapper, joined by the customer tab (DRY round 11, CUSTTABS2).
import { appointmentsTabGate } from '@/components/drawer/appointmentsTabGate'
import AppointmentEditModal from '@/components/drawer/AppointmentEditModal'
import { useAuth } from '@/context/AuthContext'
import { useVacancyAppointments } from '../hooks/useVacancyAppointments'
import { useAppointmentEditing } from '@/hooks/useAppointmentEditing'
import PickCandidateForAppointmentModal from './PickCandidateForAppointmentModal'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

/**
 * AppointmentsTab (AFSPRAKEN-VACATURE-1, VACDRAWER-ACTIONS-1) — every
 * appointment tied to this vacancy across ALL candidates, ordered by
 * scheduled_at ASCENDING (soonest first — AppointmentController::vacancyIndex
 * orderBy('scheduled_at'); GET /vacancies/{id}/appointments, gated
 * vacancies.view). Server-paginated. CREATE + EDIT reuse the SAME shared
 * PlanIntakeModal every other surface uses (candidate/application drawer,
 * vacancy applicant row) — never a second composer:
 * - CREATE: this vacancy has no single candidate in view, so "+ Afspraak"
 *   first opens PickCandidateForAppointmentModal (a searchable candidate
 *   pick), then hands the pick to PlanIntakeModal with the vacancy PRESET
 *   (`defaultVacancyId`).
 * - EDIT: each row already carries its own `candidateId` (AppointmentResource
 *   field), so the pencil opens PlanIntakeModal directly, prefilled, no picker
 *   needed — mirrors applications/drawer/AppointmentsTab's edit pencil.
 * Mirrors MatchesTab's anatomy otherwise (§3A: extend, never fork a new shape).
 */
export default function AppointmentsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const auth = useAuth()
  const [page, setPage] = useState(1)
  // "+ Afspraak" flow: pick a candidate first, then the shared modal opens.
  const [creating, setCreating] = useState(false)

  // UI-side mirror of the backend's own permission:vacancies.view gate — the
  // server re-checks, this only avoids firing a request the user will 403 on.
  const canView = auth?.hasPermission?.('vacancies.view') ?? false
  // Create/edit go through /candidates/{id}/appointments, gated
  // candidates.update — readonly/backoffice/sales hold vacancies.view WITHOUT
  // it, so an ungated pencil would die on a 403 at save (§3, Opus F1).
  const canManage = auth?.hasPermission?.('candidates.update') ?? false

  const { rows, total, lastPage, loading, error } = useVacancyAppointments(canView ? v.id : undefined, page)

  // Shared appointment editing state (editing + setEditing + reload + toExisting transform).
  // The extra field (vacancy_id) is specific to this vacancy context.
  const { editing, setEditing, reload, toExisting } = useAppointmentEditing({
    queryKey: ['vacancies', v.id, 'appointments'],
    extra: { vacancy_id: v.id ?? null },
  })

  // Four explicit UI states (§3): loading / error / empty / success.
  const gate = appointmentsTabGate({ canView, loading, error, t })
  if (gate) return gate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* "+ Afspraak" — right-aligned, mirrors ApplicantsTab's own toolbar button
          placement. Guarded on a real vacancy id (nothing to preset otherwise). */}
      {v.id != null && canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <DrawerAddButton onClick={() => setCreating(true)} label={t('appointmentsTab.new')} short />
        </div>
      )}
      {/* X-38: the rows + page footer are the shared AppointmentsList (customer tab uses the same). */}
      <AppointmentsList rows={rows} total={total} page={page} lastPage={lastPage} onPageChange={setPage}
        emptyText={t('appointmentsTab.empty')} canManage={canManage}
        onEdit={a => setEditing({ candidateId: a.candidateId as Id, appt: toExisting(a) })} />
      {creating && v.id != null && (
        <PickCandidateForAppointmentModal vacancyId={v.id}
          onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload() }} />
      )}
      <AppointmentEditModal editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
    </div>
  )
}
