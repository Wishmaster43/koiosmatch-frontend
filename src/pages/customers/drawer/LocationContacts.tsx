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
import { X, Pencil, Link2, Unlink } from 'lucide-react'
import { AddButton } from '@/components/forms/fields'
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

// Small couple-picker: the customer's contacts not already at this location.
function CouplePicker({ candidates, onPick, onClose }: { candidates: Contact[]; onClose: () => void; onPick: (id: Id) => void }) {
  const { t } = useTranslation('customers')
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('locations.detail.pickContactTitle')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {candidates.length === 0 && <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('locations.detail.pickContactEmpty')}</div>}
          {candidates.map(c => (
            <button key={String(c.id)} onClick={() => onPick(c.id as Id)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '9px 16px', fontSize: 12, textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)' }}>
              <span style={{ flex: 1 }}>{c.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>{c.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
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
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setModal('couple')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Link2 size={11} /> {t('locations.detail.coupleAction')}
          </button>
          <AddButton onClick={() => setModal('add')} label={t('locations.detail.addContactHere')} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('locations.detail.none')}</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {rows.map((c, i) => (
            <div key={String(c.id)} style={{ ...rowStyle, borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ flex: 1, color: 'var(--text)' }}>{c.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>{[c.role, c.email].filter(Boolean).join(' · ')}</span>
              <button onClick={() => setModal(c)} title={t('common:edit')} style={iconBtn}><Pencil size={12} /></button>
              <button onClick={() => onUpdate(c.id as Id, { locationId: null })} title={t('locations.detail.uncoupleAction')} style={iconBtn}><Unlink size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {modal === 'couple' && (
        <CouplePicker candidates={candidates} onClose={() => setModal(null)} onPick={id => { onUpdate(id, { locationId }); setModal(null) }} />
      )}
      {modal === 'add' && (
        <AddContactPersonModal
          locations={locations} departments={departments} statuses={statuses} lockLocationId={locationId} customerName={locationName}
          onCreate={onAdd} onClose={() => setModal(null)}
        />
      )}
      {modal && modal !== 'add' && modal !== 'couple' && (
        <AddContactPersonModal
          initial={modal} locations={locations} departments={departments} statuses={statuses}
          onCreate={payload => onUpdate(modal.id as Id, payload)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
