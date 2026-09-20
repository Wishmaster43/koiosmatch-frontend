/**
 * DepartmentsTab — the customer drawer's Afdelingen tab. A thin host around the shared
 * DepartmentsPanel, which is now the ONE department surface: the same table, chips,
 * search, actions and drill-down are rendered inside a location too (Danny 28-07: what
 * you're doing now for the contacts, you still need to do for the
 * departments on a location).
 *
 * Everything this file used to own — the column definitions, the search shell, the add
 * modal and the drill-in via SubEntityTab — moved into that panel, so there is one copy
 * instead of two. The panel keeps its drill-down IN PLACE, which is why this tab no
 * longer needs SubEntityTab at all.
 */
import { useState } from 'react'
import DepartmentsPanel from './DepartmentsPanel'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

interface Props {
  customerId?: Id
  // Point 1 (Danny's ten-point round): threaded down to each department's own
  // ScopedVacanciesTab "+" lock (mirrors the customer-level VacanciesTab's own).
  customerName?: string
  departments?: Department[]
  contacts?: Contact[]
  locations?: { id: Id; name: string }[]
  statuses?: LookupOption[]
  // AUDIT-NAFIX-1 (§3 four UI states): passed straight through to DepartmentsPanel.
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  // EXTRACT-1: the caller's own customers.update permission check, threaded down
  // to the Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  onAdd: (payload: DepartmentPayload, locationName?: string) => void
  onUpdate: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemove: (id: Id) => void
  /** Lookups + writers the nested ContactsPanel needs. */
  contactStatuses?: LookupOption[]
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  onRemoveContact: (id: Id) => void
}

// Thin host that owns which department is open and passes it to the one shared DepartmentsPanel, which renders everything else (see file header).
export default function DepartmentsTab({
  customerId, customerName, departments = [], contacts = [], locations = [], statuses = [], canLinkBackoffice = false,
  loading, error, onRetry,
  contactStatuses = [], onAdd, onUpdate, onRemove, onAddContact, onUpdateContact, onRemoveContact,
}: Props) {
  // The host owns "which department is open" — the panel is controlled (see its docblock).
  const [openId, setOpenId] = useState<Id | null>(null)
  return (
    <DepartmentsPanel
      scope="customer" openId={openId} onOpenChange={setOpenId}
      customerId={customerId} customerName={customerName}
      loading={loading} error={error} onRetry={onRetry}
      departments={departments} contacts={contacts} locations={locations} statuses={statuses}
      contactStatuses={contactStatuses} canLinkBackoffice={canLinkBackoffice}
      onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove}
      onAddContact={onAddContact} onUpdateContact={onUpdateContact} onRemoveContact={onRemoveContact}
    />
  )
}
