/**
 * CustomerRelationTab (renamed from KlantTab/CustomerTab — canon Dutch-identifier
 * sweep) — the customer this opportunity is linked to (customer → location →
 * department → contact). Read-only by default (values hyperlink to the customer record —
 * §3A cross-entity links); the pencil opens the same searchable customer picker +
 * dependent location/department/contact cascade the create modal uses
 * (useCustomerCascade), so re-pointing the deal at a different client/location is a
 * single in-place edit — no separate screen. Picking a new client resets the
 * dependent picks (cascade integrity). Contacts are a flat, customer-wide list
 * (useCustomerCascade), so a coupled contact is always selectable regardless of
 * whether location/department are set yet; departments are nested PER location on
 * the API, so this tab additionally flattens them across all locations whenever no
 * location is (yet) picked — otherwise an already-coupled department silently
 * couldn't render as selected (Danny: "Locatie/Afdeling ... Selecteer" while
 * Contactpersoon already showed correctly, i.e. "Location/Department ...
 * Select" while Contact already showed correctly) — and picking a department
 * directly auto-fills its parent location for a consistent pair.
 */
import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { contactOptionLabel } from '@/lib/contactLabel'
import { Building2, Edit2, Save, X } from 'lucide-react'
import DetailTableJs from '@/components/ui/DetailTable'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SelectMenu from '@/components/ui/SelectMenu'
import EntityLink from '@/components/ui/EntityLink'
import { GroupLabel, Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { useCustomerCascade} from '../hooks/useCustomerCascade'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

interface CustomerOption { id: Id; name: string }
type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

// Titled card wrapper (consistent with the Details tab). `clip` stays true for the
// read-only DetailTable (its full-bleed row background needs the corner clip), but
// MUST be false in edit mode — the overflow:hidden clipped the SelectMenu/
// CreatableSelect dropdown against the card edge (Danny: "dropdown werkt niet goed").
// Canon (05-08): the shared GroupLabel atom, reused instead of a hand-rolled heading.
function Card({ title, children, clip = true }: { title: ReactNode; children: ReactNode; clip?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 6 }}>{title}</GroupLabel>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: clip ? 'hidden' : 'visible' }}>{children}</div>
    </div>
  )
}

// A labelled field wrapper for the edit-mode cascade selects.
function F({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Caption as="div" style={{ marginBottom: 4 }}>{label}</Caption>
      {children}
    </div>
  )
}

export default function CustomerRelationTab({ opportunity: o, customers = [], onUpdate }: {
  opportunity: Opportunity; customers?: CustomerOption[]; onUpdate?: UpdateFn
}) {
  const { t } = useTranslation('opportunities')
  const [editing, setEditing] = useState(false)
  const [customerId,   setCustomerId]   = useState('')
  const [locationId,   setLocationId]   = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [contactId,    setContactId]    = useState('')
  const { locations, contacts } = useCustomerCascade(customerId)
  // Departments are nested per location (CustomerLocationResource), so a flat,
  // cross-location list is needed to show an ALREADY-coupled department before its
  // parent location has been (re-)picked — mirrors why `contacts` above is never
  // filtered to nothing. Once a location IS picked, narrow to just its departments
  // (cascade integrity); until then, show every department across all locations —
  // picking one auto-fills its parent location (see handleDepartmentChange).
  const allDepartments = locations.flatMap(l => (l.departments ?? []).map(d => ({ ...d, locationId: l.id })))
  const departments = locationId
    ? (locations.find(l => String(l.id) === locationId)?.departments ?? [])
    : allDepartments

  // Seed the draft from the current opportunity when edit mode opens.
  const startEdit = () => {
    setCustomerId(o.clientId != null ? String(o.clientId) : '')
    setLocationId(o.locationId != null ? String(o.locationId) : '')
    setDepartmentId(o.departmentId != null ? String(o.departmentId) : '')
    setContactId(o.contactId != null ? String(o.contactId) : '')
    setEditing(true)
  }
  const cancel = () => setEditing(false)
  const handleCustomerChange = (v: string) => {
    setCustomerId(v)
    setLocationId(''); setDepartmentId(''); setContactId('')
  }
  const handleLocationChange = (v: string) => { setLocationId(v); setDepartmentId('') }
  // Picking a department directly (before its parent location is set) auto-fills
  // that location too, so the pair stays consistent for save() and the narrowed
  // per-location list still works if the user then revisits the location field.
  const handleDepartmentChange = (v: string) => {
    setDepartmentId(v)
    if (!locationId) {
      const parent = allDepartments.find(d => String(d.id) === v)
      if (parent?.locationId != null) setLocationId(String(parent.locationId))
    }
  }

  // Resolve the picked ids back to display names (from the cascade already
  // loaded for this customer) so the optimistic UI update shows the new labels
  // immediately, without waiting on a refetch.
  const save = () => {
    const cust = customers.find(c => String(c.id) === customerId)
    const loc  = locations.find(l => String(l.id) === locationId)
    const dep  = departments.find(d => String(d.id) === departmentId)
    const con  = contacts.find(c => String(c.id) === contactId)
    onUpdate?.(o.id, {
      clientId: customerId || null,     client: cust?.name ?? '',
      locationId: locationId || null,   location: loc?.name ?? '',
      departmentId: departmentId || null, department: dep?.name ?? '',
      contactId: contactId || null,     contact: con?.name ?? '',
    })
    setEditing(false)
  }

  // Read-mode values link through to the customer record (Danny: "hyperlinks?").
  // Location/department/contact are sub-records of the customer without their
  // own drill-down page yet, so all four click through to the SAME customer — the
  // known limit until the customer drawer can focus a specific sub-tab/row via intent.
  const openCustomer = t('details.openCustomer')
  const link = (value: string) => <EntityLink page="customers" id={o.clientId} title={openCustomer}>{value || '—'}</EntityLink>
  const rows = [
    [t('details.client'),     link(o.client)],
    [t('details.location'),   link(o.location)],
    [t('details.department'), link(o.department)],
    [t('details.contact'),    link(o.contact)],
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
          <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>{o.client || '—'}</span>
        </div>
        {/* In-place edit toggle: pencil → diskette + ✕, same spot (§0.3 pattern). */}
        {onUpdate && (editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button variant="primary" iconOnly size="sm" onClick={save} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
            <Button variant="secondary" iconOnly size="sm" onClick={cancel} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
          </div>
        ) : (
          <Button variant="ghost" iconOnly size="sm" onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>
        ))}
      </div>

      <Card title={t('drawer.tabs.customer')} clip={!editing}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
            <F label={t('details.client')}>
              <CreatableSelect allowCreate={false} value={customerId || null} onChange={handleCustomerChange}
                placeholder={t('common:select')} options={customers.map(c => ({ value: String(c.id), label: c.name }))} />
            </F>
            <F label={t('details.location')}>
              <SelectMenu value={locationId || null} onChange={handleLocationChange}
                placeholder={customerId ? t('common:select') : t('pickClientFirst')}
                options={locations.map(l => ({ value: String(l.id), label: l.name ?? '—' }))} />
            </F>
            <F label={t('details.department')}>
              <SelectMenu value={departmentId || null} onChange={handleDepartmentChange}
                placeholder={customerId ? t('common:select') : t('pickClientFirst')}
                options={departments.map(d => ({ value: String(d.id), label: d.name ?? '—' }))} />
            </F>
            <F label={t('details.contact')}>
              <SelectMenu value={contactId || null} onChange={setContactId}
                placeholder={customerId ? t('common:select') : t('pickClientFirst')}
                options={contacts.map(c => ({ value: String(c.id), label: contactOptionLabel(c) }))} />
            </F>
          </div>
        ) : (
          // Canon (05-08): no row dividers, 11px labels (candidate ProfileTab convention).
          <DetailTable rows={rows} lastBorder={false} />
        )}
      </Card>
    </div>
  )
}
