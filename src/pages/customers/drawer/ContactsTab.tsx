/**
 * ContactsTab — the customer drawer's Contactpersonen tab. A thin host around the shared
 * ContactsPanel, which is now the ONE contact surface: the same table, chips, search,
 * actions and drill-down are rendered inside a location and a department too (Danny
 * 28-07: "het contactpersonen tabblad op locatie en afdeling komt niet overeen met dat
 * van de hoofdklant").
 *
 * Everything this file used to own — the column definitions, the singular-id fallback
 * resolver, the search shell, the add modal and the drill-in — moved into that panel, so
 * there is one copy instead of three. The panel keeps its drill-down IN PLACE, which is
 * why this tab no longer needs SubEntityTab at all.
 */
import { useState } from 'react'
import ContactsPanel from './ContactsPanel'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

interface Props {
  contacts?: Contact[]
  locations?: { id: Id; name: string }[]
  departments?: Department[]
  statuses?: LookupOption[]
  // EXTRACT-1: the caller's own customers.update permission check, threaded down
  // to the Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  onAdd: (payload: ContactPayload) => void
  onUpdate: (id: Id, payload: Partial<ContactPayload>) => void
  onRemove: (id: Id) => void
}

export default function ContactsTab({
  contacts = [], locations = [], departments = [], statuses = [], canLinkBackoffice = false,
  onAdd, onUpdate, onRemove,
}: Props) {
  // The host owns "which contact is open" — the panel is controlled (see its docblock).
  const [openContactId, setOpenContactId] = useState<Id | null>(null)
  return (
    <ContactsPanel
      scope="customer" openId={openContactId} onOpenChange={setOpenContactId}
      contacts={contacts} locations={locations} departments={departments} statuses={statuses}
      canLinkBackoffice={canLinkBackoffice}
      onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove}
    />
  )
}
