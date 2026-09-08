/**
 * AppointmentsTab — the customer drawer's Afspraken tab (X-38, AFSPRAKEN-PLEK-1;
 * TIJDLIJN-OVERAL family). Lists every appointment tied to this customer through
 * any of its four customer-side keys (GET /appointments?customer_id=, server-side
 * OR over customer / location / department / contact) through the shared
 * AppointmentsList (same rows as the vacancy tab, §3A: extend, never fork) with the
 * EDIT flow into the shared PlanIntakeModal (each row carries its own candidate).
 * No "+ Afspraak" here: an appointment needs a candidate, and this tab has no candidate
 * context to preset (PlanIntakeModal has no customer preset either) — a create button
 * that silently drops the customer link would be a fake affordance (§3).
 * The customer drill-down is FROZEN: this tab is purely additive.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import SectionCard from '@/components/ui/SectionCard'
import AppointmentsList from '@/components/drawer/AppointmentsList'
import { useAuth } from '@/context/AuthContext'
import { useCustomerAppointments } from '../hooks/useCustomerAppointments'
import { PlanIntakeModal } from '@/pages/candidates/shared'
import type { ExistingAppointment } from '@/pages/candidates/shared'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'
import type { Id } from '@/types/common'

// The appointment being edited plus the candidate that owns it (every row can belong to a different candidate).
interface EditingAppointment { candidateId: Id; appt: ExistingAppointment }

export default function AppointmentsTab({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<EditingAppointment | null>(null)

  // UI-side mirror of the server gate on the appointments index; edit goes through
  // /candidates/{id}/appointments (candidates.update) like the vacancy tab.
  const canView = auth?.hasPermission?.('customers.view') ?? false
  const canManage = auth?.hasPermission?.('candidates.update') ?? false

  const { rows, total, lastPage, loading, error } = useCustomerAppointments(canView ? customerId : undefined, page)

  // Re-fetch this customer's appointment pages after an edit (partial key match hits every page).
  const reload = () => queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'appointments'] })

  // A stored row → the shape PlanIntakeModal edits (PATCH /candidates/{candidateId}/appointments/{id}).
  const toExisting = (a: VacancyAppointmentRow): ExistingAppointment => ({
    id: a.id, scheduled_at: a.scheduledAt ?? undefined, duration_min: a.durationMin, modality: a.modality ?? undefined,
    owner_id: a.ownerId ?? undefined, type: a.type ?? undefined, location_id: a.locationId, appointment_location: a.appointmentLocation,
  })

  if (!canView) {
    return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('appointmentsTab.noPermission')}</div></SectionCard>
  }
  // Four explicit UI states (§3): loading / error / empty / success.
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('appointmentsTab.loadError')}</div></SectionCard>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AppointmentsList rows={rows} total={total} page={page} lastPage={lastPage} onPageChange={setPage}
        emptyText={t('appointmentsTab.empty')} canManage={canManage}
        onEdit={a => setEditing({ candidateId: a.candidateId as Id, appt: toExisting(a) })} />
      {editing && (
        <PlanIntakeModal candidateId={editing.candidateId} existing={editing.appt} mode="appointment"
          onClose={() => setEditing(null)} onCreated={() => { setEditing(null); reload() }} />
      )}
    </div>
  )
}
