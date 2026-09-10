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
import AppointmentsList from '@/components/drawer/AppointmentsList'
// Shared no-permission/loading/error gate + edit-modal wrapper, joined by the vacancy tab (DRY round 11, CUSTTABS2).
import { appointmentsTabGate } from '@/components/drawer/appointmentsTabGate'
import AppointmentEditModal from '@/components/drawer/AppointmentEditModal'
import { useAuth } from '@/context/AuthContext'
import { useCustomerAppointments } from '../hooks/useCustomerAppointments'
import { useAppointmentEditing } from '@/hooks/useAppointmentEditing'
import type { Id } from '@/types/common'

export default function AppointmentsTab({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const [page, setPage] = useState(1)

  // UI-side mirror of the server gate on the appointments index; edit goes through
  // /candidates/{id}/appointments (candidates.update) like the vacancy tab.
  const canView = auth?.hasPermission?.('customers.view') ?? false
  const canManage = auth?.hasPermission?.('candidates.update') ?? false

  const { rows, total, lastPage, loading, error } = useCustomerAppointments(canView ? customerId : undefined, page)

  // Shared appointment editing state (editing + setEditing + reload + toExisting transform).
  const { editing, setEditing, reload, toExisting } = useAppointmentEditing({
    queryKey: ['customers', customerId, 'appointments'],
  })

  // Four explicit UI states (§3): loading / error / empty / success.
  const gate = appointmentsTabGate({ canView, loading, error, t })
  if (gate) return gate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AppointmentsList rows={rows} total={total} page={page} lastPage={lastPage} onPageChange={setPage}
        emptyText={t('appointmentsTab.empty')} canManage={canManage}
        onEdit={a => setEditing({ candidateId: a.candidateId as Id, appt: toExisting(a) })} />
      <AppointmentEditModal editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
    </div>
  )
}
