/**
 * ContactDetail — the Contactpersonen-tab drill-down. Full edit via the shared
 * EditableFieldTable house pattern (pencil → save/cancel): name, function, email,
 * status and primary toggle.
 *
 * CONTACT-MULTI-1: the backend supports only ONE location + ONE department per
 * contact (customer_location_id / customer_department_id). Danny wants multi
 * eventually.
 *
 * BUG FIX (28-07): the location/department coupling used to render as TWO
 * INDEPENDENT `chip-select` fields inside the table above, so a recruiter could
 * save a department that belongs to a different location than the one picked —
 * a department belongs to exactly ONE location, so an uncoupled pair is invalid
 * data. The main table can't fix this itself: EditableFieldTable's field types
 * render independently and have no way to narrow one field's options off
 * another's live draft value. So the coupling now gets its OWN small self-
 * contained edit block below (pencil → save/cancel, same idea as the phone-
 * numbers card), using searchable CreatableSelects that CASCADE exactly like
 * AddContactPersonModal's create form: the department picker stays empty until
 * a location is picked, and picking a new location always clears the department.
 * Never a second variant of this behaviour — mirror the modal, don't reinvent it.
 *
 * Phone numbers (BE 2026-07-20 split — mobile is now a separate field from the
 * landline `phone`) get their OWN small card below the main table, NOT a plain
 * EditableFieldTable row: they need per-field icon affordances (mobile → WhatsApp,
 * landline → dial), which EditableFieldTable's generic 'text' type can't render.
 * This mirrors the candidate ProfileTab's own contact-card pattern (one edit
 * toggle per self-contained block, same as its separate summary-text editor).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Edit2, Save, X, Phone, MessageCircle } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SoftChip from '@/components/ui/SoftChip'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useCustomFields } from '@/lib/useCustomFields'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { useConfirm } from '@/hooks/useConfirm'
import { waDigits } from '@/lib/waDigits'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
const cardStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

export default function ContactDetail({ contact, locations, departments, statuses, canLinkBackoffice = false, onSave, onDelete, close }: {
  contact: Contact
  locations: { id: Id; name: string }[]
  departments: Department[]
  statuses: LookupOption[]
  // EXTRACT-1: the caller's own customers.update permission check for the
  // Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  onSave: (id: Id, payload: Partial<ContactPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
}) {
  const { t } = useTranslation('customers')
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState(false)
  // The Extra sub-tab only shows when the tenant has defined customer_contact custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_contact')
  const [subTab, setSubTab] = useState<'data' | 'extra' | 'koppelingen'>('data')
  // Contact function (job title) is a lookup combobox, split from the candidate
  // function list (FUNCTIONS-SPLIT-1) — never a plain free-text field.
  const { contactFunctions, allowFreeEntry } = useContactFunctions()

  // Location/department are no longer in this table — see the Koppeling block
  // below (file header BUG FIX 28-07): a chip-select field can't cascade off
  // another field's live draft value, so they need their own cascading picker.
  const fields: FieldRow[] = [
    { key: 'firstName', label: t('subModal.firstName'), type: 'text' },
    { key: 'lastName', label: t('subModal.lastName'), type: 'text' },
    { key: 'role', label: t('contacts.detail.role'), type: 'creatable', options: contactFunctions, allowCreate: allowFreeEntry },
    { key: 'email', label: t('contacts.detail.email'), type: 'text' },
    { key: 'statusId', label: t('locations.detail.status'), type: 'select', options: statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })) },
    { key: 'isPrimary', label: t('contacts.detail.primary'), type: 'checkbox' },
  ]

  const values = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    role: contact.role,
    email: contact.email,
    statusId: contact.statusId != null ? String(contact.statusId) : '',
    isPrimary: contact.isPrimary,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(contact.id as Id, {
      firstName: v.firstName as string, lastName: v.lastName as string,
      role: v.role as string, email: v.email as string,
      statusId: (v.statusId as string) || null,
      isPrimary: Boolean(v.isPrimary),
    })
    setEditing(false)
  }

  const remove = () => confirm(t('contacts.deleteConfirm'), () => { onDelete(contact.id as Id); close() }, { danger: true })

  // Location/department coupling — own self-contained edit block (pencil →
  // save/cancel), cascading exactly like AddContactPersonModal (file header
  // BUG FIX 28-07): empty-until-a-location-is-picked, and picking a new
  // location always clears the department (a department belongs to exactly
  // one location, so any location change invalidates the previous pick).
  const [linkEditing, setLinkEditing] = useState(false)
  const [linkForm, setLinkForm] = useState<{ locationId: Id | null; departmentId: Id | null }>({
    locationId: contact.locationId, departmentId: contact.departmentId,
  })
  const startLinkEdit = () => { setLinkForm({ locationId: contact.locationId, departmentId: contact.departmentId }); setLinkEditing(true) }
  const cancelLinkEdit = () => { setLinkForm({ locationId: contact.locationId, departmentId: contact.departmentId }); setLinkEditing(false) }
  const saveLink = () => { onSave(contact.id as Id, { locationId: linkForm.locationId || null, departmentId: linkForm.departmentId || null }); setLinkEditing(false) }

  // Department options stay EMPTY until a location is picked — never fall back
  // to "every department of this customer": a department belongs to exactly one
  // location, so offering the full list would let a mismatched pair get saved.
  const departmentsForLocation = linkForm.locationId
    ? departments.filter(d => String(d.locationId) === String(linkForm.locationId))
    : []
  // A department set before this fix existed may not belong to the current
  // draft location — keep it visible in the option list so its label still
  // resolves instead of the trigger falling back to a raw id string.
  const selectedDepartment = linkForm.departmentId ? departments.find(d => String(d.id) === String(linkForm.departmentId)) : undefined
  const departmentOptions = (selectedDepartment && !departmentsForLocation.some(d => String(d.id) === String(selectedDepartment.id))
    ? [...departmentsForLocation, selectedDepartment]
    : departmentsForLocation
  ).map(d => ({ value: String(d.id), label: d.name }))
  const departmentPlaceholder = !linkForm.locationId ? t('subModal.pickLocationFirst')
    : departmentOptions.length === 0 ? t('common:noResults')
    : t('subModal.noneOption')

  // Read-mode labels — resolved against the customer-wide lists, never trusted
  // straight off contact.locationName/departmentName: the list endpoint leaves
  // those empty for every seeded contact (only the ids are populated), the same
  // measured gap ContactsTab's own resolvedLocations/resolvedDepartments works around.
  const linkedLocation = contact.locationId ? locations.find(l => String(l.id) === String(contact.locationId)) : undefined
  const linkedDepartment = contact.departmentId ? departments.find(d => String(d.id) === String(contact.departmentId)) : undefined

  // Phone numbers — own small self-contained edit block (pencil → save/cancel),
  // same pattern as the candidate ProfileTab's contact card (mobile → WhatsApp,
  // landline → dial; see file header for why this can't live in EditableFieldTable).
  const [numbersEditing, setNumbersEditing] = useState(false)
  const [numbersForm, setNumbersForm] = useState({ mobile: contact.mobile ?? '', phone: contact.phone ?? '' })
  const startNumbersEdit = () => { setNumbersForm({ mobile: contact.mobile ?? '', phone: contact.phone ?? '' }); setNumbersEditing(true) }
  const saveNumbers = () => { onSave(contact.id as Id, { mobile: numbersForm.mobile, phone: numbersForm.phone }); setNumbersEditing(false) }
  const cancelNumbers = () => { setNumbersForm({ mobile: contact.mobile ?? '', phone: contact.phone ?? '' }); setNumbersEditing(false) }

  // One number row: label-left, value-right — a tel: link + the field's ONE fixed
  // shortcut icon (WhatsApp for mobile, dial for landline) while not editing.
  const numberRow = (key: 'mobile' | 'phone', label: string) => {
    const v = contact[key]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26, padding: '0 12px', height: 38 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {numbersEditing ? (
            <input value={numbersForm[key]} onChange={e => setNumbersForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
          ) : v ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <a href={`tel:${String(v).replace(/\s/g, '')}`} style={{ fontSize: 12, color: 'var(--color-info)', textDecoration: 'none' }}>{v}</a>
              {key === 'mobile' && waDigits(v) && (
                <a href={`https://wa.me/${waDigits(v)}`} target="_blank" rel="noopener noreferrer"
                  title={t('contacts.detail.whatsapp')} aria-label={t('contacts.detail.whatsapp')}
                  style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-success)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <MessageCircle size={13} />
                </a>
              )}
              {key === 'phone' && (
                <a href={`tel:${String(v).replace(/\s/g, '')}`}
                  title={t('contacts.detail.callPhone')} aria-label={t('contacts.detail.callPhone')}
                  style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-info)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <Phone size={13} />
                </a>
              )}
            </span>
          ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{contact.name}</div>
        <button onClick={remove} title={t('common:delete')}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--color-danger)' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Sub-tab strip — EXTRACT-1 made it unconditional (the Koppelingen sub-tab
          always shows now); Extra still only appears with ≥1 active custom field. */}
      <SubTabBar
        tabs={[
          { id: 'data',  label: t('contacts.detail.subtabs.data') },
          ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
          { id: 'koppelingen', label: t('common:backofficeLinks.tabLabel') },
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {subTab === 'data' && (
        <>
          <EditableFieldTable title={t('contacts.detail.infoTitle')} fields={fields} value={values} onSave={save}
            editing={editing} onStartEdit={() => setEditing(true)} onCancel={() => setEditing(false)} labelWidth={130} />

          {/* Koppeling — location/department, own cascading edit block (see file
              header BUG FIX 28-07). Mirrors AddContactPersonModal's picker pair. */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('subModal.groups.link')}</span>
              {linkEditing ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={saveLink} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
                  <button onClick={cancelLinkEdit} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
                </div>
              ) : (
                <button onClick={startLinkEdit} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
              )}
            </div>
            <div style={{ ...cardStyle, padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26, padding: '0 12px', height: 38 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{t('contacts.detail.location')}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {linkEditing ? (
                    <CreatableSelect value={linkForm.locationId != null ? String(linkForm.locationId) : null} allowCreate={false}
                      onChange={v => setLinkForm({ locationId: v || null, departmentId: null })}
                      placeholder={t('subModal.noneOption')} options={locations.map(l => ({ value: String(l.id), label: l.name }))} />
                  ) : linkedLocation ? <SoftChip label={linkedLocation.name} color="var(--color-secondary)" /> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26, padding: '0 12px', height: 38 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{t('contacts.detail.department')}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {linkEditing ? (
                    <CreatableSelect value={linkForm.departmentId != null ? String(linkForm.departmentId) : null} allowCreate={false}
                      onChange={v => setLinkForm(f => ({ ...f, departmentId: v || null }))}
                      placeholder={departmentPlaceholder} options={departmentOptions} />
                  ) : linkedDepartment ? <SoftChip label={linkedDepartment.name} color="var(--color-violet)" /> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('contacts.detail.numbersTitle')}</span>
              {numbersEditing ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={saveNumbers} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
                  <button onClick={cancelNumbers} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
                </div>
              ) : (
                <button onClick={startNumbersEdit} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
              )}
            </div>
            <div style={{ ...cardStyle, padding: '4px 0' }}>
              {numberRow('mobile', t('contacts.detail.mobile'))}
              {numberRow('phone', t('contacts.detail.phone'))}
            </div>
          </div>
        </>
      )}

      {subTab === 'extra' && customFieldDefs.length > 0 && (
        <CustomFieldsTab entityType="customer_contact" values={contact.customFields ?? {}}
          onSave={patch => onSave(contact.id as Id, { customFields: { ...contact.customFields, ...patch } })} />
      )}
      {subTab === 'koppelingen' && (
        <BackofficeLinksTab entity="contacts" id={contact.id as Id} helloflexLink={contact.helloflexLink} shiftmanagerLink={contact.shiftmanagerLink} canLink={canLinkBackoffice} />
      )}
      {dialog}
    </div>
  )
}
