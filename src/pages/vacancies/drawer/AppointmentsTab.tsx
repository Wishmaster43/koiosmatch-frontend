/**
 * AppointmentsTab — see the fuller docblock below, right above the component,
 * for the vacancy-wide appointments list this tab renders and how its
 * create/edit flows reuse the shared PlanIntakeModal.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import SectionCard from '@/components/ui/SectionCard'
import AppointmentsList from '@/components/drawer/AppointmentsList'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { useAuth } from '@/context/AuthContext'
import { useVacancyAppointments } from '../hooks/useVacancyAppointments'
import { PlanIntakeModal } from '@/pages/candidates/shared'
import type { ExistingAppointment } from '@/pages/candidates/shared'
import PickCandidateForAppointmentModal from './PickCandidateForAppointmentModal'
import type { VacancyDetail } from '@/types/vacancy'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'
import type { Id } from '@/types/common'

// The appointment being edited, plus WHICH candidate owns it (unlike the
// candidate/application drawer's own copy of this modal, every row here can
// belong to a DIFFERENT candidate — the candidate id never comes from a single
// fixed context, so it must travel alongside the prefill data).
interface EditingAppointment { candidateId: Id; appt: ExistingAppointment }

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
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  // "+ Afspraak" flow: pick a candidate first, then the shared modal opens.
  const [creating, setCreating] = useState(false)
  // Pencil-edit flow: the row's own candidate + prefilled appointment fields.
  const [editing, setEditing] = useState<EditingAppointment | null>(null)

  // UI-side mirror of the backend's own permission:vacancies.view gate — the
  // server re-checks, this only avoids firing a request the user will 403 on.
  const canView = auth?.hasPermission?.('vacancies.view') ?? false
  // Create/edit go through /candidates/{id}/appointments, gated
  // candidates.update — readonly/backoffice/sales hold vacancies.view WITHOUT
  // it, so an ungated pencil would die on a 403 at save (§3, Opus F1).
  const canManage = auth?.hasPermission?.('candidates.update') ?? false

  const { rows, total, lastPage, loading, error } = useVacancyAppointments(canView ? v.id : undefined, page)

  // Re-fetch this vacancy's appointment list after a create/edit — react-query's
  // partial key match invalidates every cached page, not just the current one.
  const reload = () => queryClient.invalidateQueries({ queryKey: ['vacancies', v.id, 'appointments'] })

  // A stored row → the shape PlanIntakeModal's `existing` prop edits (PATCH
  // /candidates/{candidateId}/appointments/{id}) — vacancy_id stays THIS
  // vacancy since the row came from its own appointments list.
  const toExisting = (a: VacancyAppointmentRow): ExistingAppointment => ({
    id: a.id,
    scheduled_at: a.scheduledAt ?? undefined,
    duration_min: a.durationMin,
    modality: a.modality ?? undefined,
    owner_id: a.ownerId ?? undefined,
    type: a.type ?? undefined,
    vacancy_id: v.id ?? null,
    location_id: a.locationId,
    appointment_location: a.appointmentLocation,
  })

  if (!canView) {
    return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('appointmentsTab.noPermission')}</div></SectionCard>
  }
  // Four explicit UI states (§3): loading / error / empty / success.
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('appointmentsTab.loadError')}</div></SectionCard>

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
      {editing && (
        <PlanIntakeModal candidateId={editing.candidateId} existing={editing.appt} mode="appointment"
          onClose={() => setEditing(null)} onCreated={() => { setEditing(null); reload() }} />
      )}
    </div>
  )
}
