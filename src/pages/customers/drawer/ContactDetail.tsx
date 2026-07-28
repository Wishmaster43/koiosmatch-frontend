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
import { Trash2, Edit2, Save, X } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import TitleBadge from '@/components/drawer/TitleBadge'
import ContactLinkSection from './ContactLinkSection'
import { emailValue, phoneValue } from '@/components/drawer/contactLinks'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import { useCustomFields } from '@/lib/useCustomFields'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { useConfirm } from '@/hooks/useConfirm'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'


export default function ContactDetail({ contact, locations, departments, statuses, existing = [], canLinkBackoffice = false, onSave, onDelete, close }: {
  contact: Contact
  locations: { id: Id; name: string }[]
  departments: Department[]
  statuses: LookupOption[]
  /** The customer's OTHER contacts — needed to spot the current primary before replacing it. */
  existing?: Contact[]
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
  // Bumped to REMOUNT the field table when what we store differs from what was typed.
  // The table shows the draft optimistically after a save; declining the primary-replace
  // question stores isPrimary FALSE while the toggle had just been flipped ON, so without
  // this the read view kept claiming "primary" until the tab was left and re-entered
  // (measured 28-07 by an adversarial verification pass — a UI that lies about what it
  // saved is worse than one that fails loudly).
  const [tableEpoch, setTableEpoch] = useState(0)
  // The Extra sub-tab only shows when the tenant has defined customer_contact custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_contact')
  const [subTab, setSubTab] = useState<'data' | 'tasks' | 'extra' | 'koppelingen'>('data')
  // Contact function (job title) is a lookup combobox, split from the candidate
  // function list (FUNCTIONS-SPLIT-1) — never a plain free-text field.
  const { contactFunctions, allowFreeEntry } = useContactFunctions()

  // Location/department are no longer in this table — see the Koppeling block
  // below (file header BUG FIX 28-07): a chip-select field can't cascade off
  // another field's live draft value, so they need their own cascading picker.
  // ONE card for the person (Danny 28-07: "telefoonnummers en contactpersoon moeten
  // samen"). The numbers used to need their own card because they carry per-field icon
  // affordances — that is what FieldRow.renderValue is for now, so they are plain rows
  // here and the second card is gone. Status is NOT a row: it is the title-row badge
  // below, exactly like a location (§3A(c) — the header shows state, the card shows data).
  const fields: FieldRow[] = [
    { key: 'firstName', label: t('subModal.firstName'), type: 'text' },
    // CONTACT-TUSSENVOEGSEL-1: editing a contact used to drop this silently.
    { key: 'middleName', label: t('contacts.detail.middleName'), type: 'text' },
    { key: 'lastName', label: t('subModal.lastName'), type: 'text' },
    { key: 'role', label: t('contacts.detail.role'), type: 'creatable', options: contactFunctions, allowCreate: allowFreeEntry },
    { key: 'email', label: t('contacts.detail.email'), type: 'text',
      renderValue: v => emailValue(v, t('contacts.detail.email')) },
    // The WhatsApp shortcut belongs to the MOBILE number only — a landline cannot hold a
    // conversation, so offering it there would be a control that goes nowhere.
    { key: 'mobile', label: t('contacts.detail.mobile'), type: 'text',
      renderValue: v => phoneValue(v, t('contacts.detail.callPhone'), { label: t('contacts.detail.whatsapp') }) },
    { key: 'phone', label: t('contacts.detail.phone'), type: 'text',
      renderValue: v => phoneValue(v, t('contacts.detail.callPhone')) },
    { key: 'isPrimary', label: t('contacts.detail.primary'), type: 'checkbox' },
  ]

  const values = {
    firstName: contact.firstName,
    middleName: contact.middleName,
    lastName: contact.lastName,
    role: contact.role,
    email: contact.email,
    mobile: contact.mobile,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
  }

  // The customer's current primary, if it is someone else — the backend silently
  // demotes them when this contact is saved as primary, so we ask first.
  const currentPrimary = existing.find(c => c.isPrimary && String(c.id) !== String(contact.id))

  const save = (v: Record<string, unknown>) => {
    const commit = (isPrimary: boolean) => {
      onSave(contact.id as Id, {
        firstName: v.firstName as string, middleName: v.middleName as string, lastName: v.lastName as string,
        role: v.role as string, email: v.email as string,
        mobile: v.mobile as string, phone: v.phone as string,
        isPrimary,
      })
      setEditing(false)
    }
    // Promoting this contact to primary takes the flag away from someone else — never
    // silently. Declining saves the rest of the edit and leaves the other one primary.
    if (Boolean(v.isPrimary) && !contact.isPrimary && currentPrimary) {
      confirm(t('subModal.primaryReplace.body', { name: currentPrimary.name }), () => commit(true), {
        title: t('subModal.primaryReplace.title'),
        confirmLabel: t('subModal.primaryReplace.confirm'),
        cancelLabel: t('subModal.primaryReplace.decline'),
        // Declining still saves the rest of the edit — just not the flag — so the table
        // must be rebuilt from the stored values instead of its own optimistic draft.
        onCancel: () => { commit(false); setTableEpoch(e => e + 1) },
      })
      return
    }
    commit(Boolean(v.isPrimary))
  }

  // Status lives in the title row and saves on its own, independent of the field card.
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const startEditStatus = () => { setStatusDraft(contact.statusId != null ? String(contact.statusId) : ''); setEditingStatus(true) }
  const saveStatus = () => { onSave(contact.id as Id, { statusId: statusDraft || null }); setEditingStatus(false) }
  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

  const remove = () => confirm(t('contacts.deleteConfirm'), () => { onDelete(contact.id as Id); close() }, { danger: true })

  // Location/department coupling — own self-contained edit block (pencil →
  // save/cancel), cascading exactly like AddContactPersonModal (file header
  // BUG FIX 28-07): empty-until-a-location-is-picked, and picking a new
  // location always clears the department (a department belongs to exactly
  // one location, so any location change invalidates the previous pick).
  // Coupling — the shared +Vestiging-shaped section (Danny 28-07). Saving is immediate,
  // like the branch picker: pick and it is stored, remove the chip and it is cleared.
  const saveLink = (patch: { locationId?: Id | null; departmentId?: Id | null }) =>
    onSave(contact.id as Id, patch)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title row, same anatomy as a customer and a location (§3A(c)): name, the
          copyable reference number, then the STATUS as a read-only colour badge with its
          own pencil. Status is not a field-table row here — Danny 28-07: "bij de
          contactpersoon staat status in de tabel en niet naast de naam zoals bij
          locaties, we moeten het consistent houden". */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{contact.name}</div>
          <ReferenceNumberChip value={contact.referenceNumber} />
          {editingStatus ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 170 }}>
                <CreatableSelect value={statusDraft} onChange={setStatusDraft} allowCreate={false} menuWidth={180}
                  placeholder={t('locations.detail.status')}
                  options={statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))} />
              </div>
              <button onClick={saveStatus} title={t('common:save')} aria-label={t('common:save')}
                style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
              <button onClick={() => setEditingStatus(false)} title={t('common:cancel')} aria-label={t('common:cancel')}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
            </div>
          ) : (
            <>
              <TitleBadge label={contact.statusLabel} color={contact.statusColor} />
              <button onClick={startEditStatus} title={t('locations.detail.changeStatus')} aria-label={t('locations.detail.changeStatus')}
                style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
            </>
          )}
        </div>
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
          { id: 'tasks', label: t('contacts.detail.subtabs.tasks') },
          ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
          { id: 'koppelingen', label: t('common:backofficeLinks.tabLabel') },
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {subTab === 'data' && (
        <>
          <EditableFieldTable key={tableEpoch} title={t('contacts.detail.infoTitle')} fields={fields} value={values} onSave={save}
            editing={editing} onStartEdit={() => setEditing(true)} onCancel={() => setEditing(false)} labelWidth={130} />

          {/* Koppeling — same shape and behaviour as "+ Vestiging" (Danny 28-07). */}
          <ContactLinkSection locationId={contact.locationId} departmentId={contact.departmentId}
            locations={locations} departments={departments} onChange={saveLink} />

        </>
      )}

      {/* Taken — the tasks linked to THIS contact (Danny 28-07: "we willen hierop ook
          … taken hebben op de klant en gelinkt aan contactpersoon"). Reads the generic
          GET /tasks?contact={id} filter, which only started working on 28-07
          (TASKS-LINK-FILTER-1); before that the filter was silently ignored and the
          list would have shown every task in the tenant. Shared component — the
          opportunity drawer renders the exact same body. */}
      {subTab === 'tasks' && (
        <EntityTasksTab
          linkType="contact"
          id={contact.id}
          labels={{
            newTask: t('contacts.tasks.newTask'), open: t('contacts.tasks.open'), history: t('contacts.tasks.history'),
            empty: t('contacts.tasks.empty'), loading: t('contacts.tasks.loading'), error: t('contacts.tasks.error'),
            openTask: t('contacts.tasks.openTask'),
          }}
        />
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
