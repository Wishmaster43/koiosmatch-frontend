/**
 * LocationContacts — "Contactpersonen op deze locatie": the nested contact list
 * inside a location's detail. Filters the customer-wide contacts hook by this
 * location id (one source of truth shared with the top-level Contactpersonen tab).
 * "Koppelen" links an existing customer contact (PATCH customer_location_id);
 * "Ontkoppelen" unlinks it (PATCH null) without deleting the record. Edit/create
 * reuse AddContactPersonModal — never forked.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Link2, Unlink } from 'lucide-react'
// House "+ action" trigger (Danny 28-07 consistency sweep) — replaces the
// hand-rolled AddButton/borderless-link-button pair below.
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import SoftChip from '@/components/ui/SoftChip'
import ContactLinkPicker from './ContactLinkPicker'
import AddContactPersonModal from '../AddContactPersonModal'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12 }
const iconBtn = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', flexShrink: 0 }

interface Props {
  locationId: Id
  locationName?: string
  contacts: Contact[]
  locations: { id: Id; name: string }[]
  departments: Department[]
  statuses: LookupOption[]
  onAdd: (payload: ContactPayload) => void
  onUpdate: (id: Id, payload: Partial<ContactPayload>) => void
}

export default function LocationContacts({ locationId, locationName, contacts, locations, departments, statuses, onAdd, onUpdate }: Props) {
  const { t } = useTranslation('customers')
  const [modal, setModal] = useState<'add' | 'couple' | Contact | null>(null)
  const rows = contacts.filter(c => String(c.locationId) === String(locationId))
  const candidates = contacts.filter(c => String(c.locationId) !== String(locationId))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('locations.detail.contactsHere')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <DrawerAddButton onClick={() => setModal('couple')} label={t('locations.detail.coupleAction')} icon={Link2} />
          <DrawerAddButton onClick={() => setModal('add')} label={t('locations.detail.addContactHere')} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('locations.detail.none')}</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {rows.map((c, i) => (
            <div key={String(c.id)} style={{ ...rowStyle, borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {/* Primary contact of the CUSTOMER — shown here too (Danny 28-07: he
                  could not see who was primary from this list). Note the axis: the
                  flag is one-per-customer, NOT one-per-location; a per-location
                  primary needs a flag on the contact↔location pivot (CMBE ticket
                  LOCATIE-PRIMAIR-1), so never read this chip as "primary here". */}
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                {c.name}
                {c.isPrimary && <SoftChip label={t('contacts.primaryChip')} color="var(--color-success)" round size={10} />}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{[c.role, c.email].filter(Boolean).join(' · ')}</span>
              <button onClick={() => setModal(c)} title={t('common:edit')} style={iconBtn}><Pencil size={12} /></button>
              <button onClick={() => onUpdate(c.id as Id, { locationId: null })} title={t('locations.detail.uncoupleAction')} style={iconBtn}><Unlink size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {modal === 'couple' && (
        <ContactLinkPicker candidates={candidates} locations={locations} departments={departments}
          onClose={() => setModal(null)} onPick={id => { onUpdate(id, { locationId }); setModal(null) }} />
      )}
      {/* `existing` powers the modal's duplicate check (email/phone/mobile) and the
          "replace the current primary?" question — it needs the customer's WHOLE
          contact list, not just the ones at this location, because both rules are
          scoped per customer on the backend. */}
      {modal === 'add' && (
        <AddContactPersonModal
          locations={locations} departments={departments} statuses={statuses} lockLocationId={locationId} customerName={locationName}
          existing={contacts} onCreate={onAdd} onClose={() => setModal(null)}
        />
      )}
      {modal && modal !== 'add' && modal !== 'couple' && (
        <AddContactPersonModal
          initial={modal} locations={locations} departments={departments} statuses={statuses}
          existing={contacts}
          onCreate={payload => onUpdate(modal.id as Id, payload)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
