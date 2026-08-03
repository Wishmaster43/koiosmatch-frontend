/**
 * DepartmentsTab — the customer drawer's Afdelingen tab. A thin host around the shared
 * DepartmentsPanel, which is now the ONE department surface: the same table, chips,
 * search, actions and drill-down are rendered inside a location too (Danny 28-07: "wat je
 * nu aan het doen bent voor de contactpersonen moet je ook nog doen voor de afdelingen op
 * een locatie").
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

export default function DepartmentsTab({
  customerId, customerName, departments = [], contacts = [], locations = [], statuses = [], canLinkBackoffice = false,
  contactStatuses = [], onAdd, onUpdate, onRemove, onAddContact, onUpdateContact, onRemoveContact,
}: Props) {
  // The host owns "which department is open" — the panel is controlled (see its docblock).
  const [openId, setOpenId] = useState<Id | null>(null)
  return (
    <DepartmentsPanel
      scope="customer" openId={openId} onOpenChange={setOpenId}
      customerId={customerId} customerName={customerName}
      departments={departments} contacts={contacts} locations={locations} statuses={statuses}
      contactStatuses={contactStatuses} canLinkBackoffice={canLinkBackoffice}
      onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove}
      onAddContact={onAddContact} onUpdateContact={onUpdateContact} onRemoveContact={onRemoveContact}
    />
  )
}
