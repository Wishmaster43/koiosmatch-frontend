/**
 * ContactsTab — the customer's contact persons as a searchable table. Each row
 * shows the coupled LOCATIONS + DEPARTMENTS (CONTACT-MULTI-1: a contact can serve
 * several sites/departments) as one soft chip per link; a row drills into
 * ContactDetail for full edit (EditableFieldTable house pattern) + delete.
 * "+ Nieuw contactpersoon" opens the full grouped AddContactPersonModal.
 *
 * BUG FIX (Danny 2026-07-14): the Locatie/Afdeling columns used to read the
 * singular locationName/departmentName, which the list endpoint never populates
 * (only the plural locations[]/departments[] are eager-loaded there) — every row
 * showed "—" even though the coupling existed (visible on drill-in). Fixed in the
 * mapper (mapContact) by reading the arrays; rendered here as multi-ready chips.
 *
 * MEASURED (2026-07-14): for every currently-seeded demo contact the plural
 * locations[]/departments[] arrays come back EMPTY — only the legacy singular
 * customer_location_id/customer_department_id are populated (CONTACT-MULTI-1's
 * pivot tables were never backfilled from the pre-existing singular columns —
 * filed as a BE finding in the delivery report). Until that backfill ships, this
 * tab falls back to resolving the singular id against the customer-wide
 * locations/departments PROPS it already has (same ones ContactDetail uses) so
 * the column isn't stuck on "—" for every row in the meantime.
 *
 * Dedupe-by-id for a measured duplicate-row issue lives at the shared source
 * (useCustomerContacts) so both this tab AND the location detail's nested list
 * stay correct — see that hook's docblock for the finding.
 */
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Check } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import ContactDetail from './ContactDetail'
import AddContactPersonModal from '../AddContactPersonModal'
import type { Column } from '@/components/ui/DataTable'
import SoftChipJs from '@/components/ui/SoftChip'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>
const muted = { color: 'var(--text-muted)', fontSize: 12 }

interface Props {
  contacts?: Contact[]
  locations?: { id: Id; name: string }[]
  departments?: Department[]
  statuses?: LookupOption[]
  onAdd: (payload: ContactPayload) => void
  onUpdate: (id: Id, payload: Partial<ContactPayload>) => void
  onRemove: (id: Id) => void
}

// One soft chip per linked location/department; a wrapped row so a contact
// serving several sites still reads cleanly (multi-ready, CONTACT-MULTI-1).
const chipList = (items: { id: Id; name: string }[], color: string) =>
  items.length === 0 ? '—' : (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map(i => <SoftChip key={String(i.id)} label={i.name} color={color} />)}
    </div>
  )

export default function ContactsTab({ contacts = [], locations = [], departments = [], statuses = [], onAdd, onUpdate, onRemove }: Props) {
  const { t } = useTranslation('customers')
  const [adding, setAdding] = useState(false)

  // Fallback resolver — the multi-array (see file docblock) is empty for every
  // seeded contact today; resolve the PRIMARY singular link against the already-
  // fetched customer-wide lists so the column shows real data, not a blanket "—".
  const resolvedLocations = (p: Contact) => p.locations.length > 0 ? p.locations
    : (p.locationId != null ? locations.filter(l => String(l.id) === String(p.locationId)) : [])
  const resolvedDepartments = (p: Contact): { id: Id; name: string }[] => p.departments.length > 0 ? p.departments
    : (p.departmentId != null ? departments.filter(d => String(d.id) === String(p.departmentId)).map(d => ({ id: d.id as Id, name: d.name })) : [])

  const columns: Column<Contact>[] = [
    { key: 'name', header: t('contacts.col.name'), sortable: true, sortValue: p => p.name,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{p.name}</span>
          {p.isPrimary && <Check size={12} color="var(--color-success)" />}
        </div>
      ) },
    { key: 'location', header: t('contacts.col.location'), sortable: true, sortValue: p => p.locationName,
      render: p => chipList(resolvedLocations(p), 'var(--color-secondary)') },
    { key: 'department', header: t('contacts.col.department'), sortable: true, sortValue: p => p.departmentName,
      render: p => chipList(resolvedDepartments(p), 'var(--color-violet)') },
    { key: 'role',  header: t('contacts.col.role'),  cellStyle: muted, sortable: true, sortValue: p => p.role,  render: p => p.role || '—' },
    { key: 'email', header: t('contacts.col.email'), cellStyle: muted, sortable: true, sortValue: p => p.email, render: p => p.email || '—' },
    // Single column, sensible fallback (BE 2026-07-20 split): prefer the mobile
    // number, fall back to the landline — one column stays one column.
    { key: 'phone', header: t('contacts.col.phone'), nowrap: true, cellStyle: muted, sortable: true, sortValue: p => p.mobile || p.phone, render: p => p.mobile || p.phone || '—' },
  ]

  const renderDetail = (p: Contact, close: () => void) => (
    <ContactDetail contact={p} locations={locations} departments={departments} statuses={statuses}
      onSave={onUpdate} onDelete={onRemove} close={close} />
  )

  return (
    <>
      <SubEntityTab
        items={contacts}
        columns={columns}
        addLabel={t('contacts.add')}
        emptyText={t('contacts.empty')}
        searchPlaceholder={t('contacts.searchPlaceholder')}
        backLabel={t('drawer.back')}
        searchKeys={['name', 'role', 'email']}
        onAdd={() => setAdding(true)}
        renderDetail={renderDetail}
      />
      {adding && (
        <AddContactPersonModal locations={locations} departments={departments} statuses={statuses}
          onCreate={onAdd} onClose={() => setAdding(false)} />
      )}
    </>
  )
}
