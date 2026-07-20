/**
 * ContactDetail — the Contactpersonen-tab drill-down. Full edit via the shared
 * EditableFieldTable house pattern (pencil → save/cancel): name, function, email,
 * status, primary toggle, and the location/department coupling.
 *
 * CONTACT-MULTI-1: the backend supports only ONE location + ONE department per
 * contact (customer_location_id / customer_department_id). Danny wants multi
 * eventually, so the coupling renders as `chip-select` — a single-value soft-chip
 * picker (not a plain <select>) — so flipping to multi later is a prop change on
 * EditableFieldTable, not a rebuild. Never silently drop a second value; there is
 * nowhere on the backend to put it yet (filed as a BE gap in the delivery report).
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
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useCustomFields } from '@/lib/useCustomFields'
import { useConfirm } from '@/hooks/useConfirm'
import { waDigits } from '@/lib/waDigits'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
const cardStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

export default function ContactDetail({ contact, locations, departments, statuses, onSave, onDelete, close }: {
  contact: Contact
  locations: { id: Id; name: string }[]
  departments: Department[]
  statuses: LookupOption[]
  onSave: (id: Id, payload: Partial<ContactPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
}) {
  const { t } = useTranslation('customers')
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState(false)
  // The Extra sub-tab only shows when the tenant has defined customer_contact custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_contact')
  const [subTab, setSubTab] = useState<'data' | 'extra'>('data')

  const fields: FieldRow[] = [
    { key: 'firstName', label: t('subModal.firstName'), type: 'text' },
    { key: 'lastName', label: t('subModal.lastName'), type: 'text' },
    { key: 'role', label: t('contacts.detail.role'), type: 'text' },
    { key: 'email', label: t('contacts.detail.email'), type: 'text' },
    { key: 'statusId', label: t('locations.detail.status'), type: 'select', options: statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })) },
    // Single-value coupling, chip UI (CONTACT-MULTI-1 — see file header).
    { key: 'locationId', label: t('contacts.detail.location'), type: 'chip-select',
      chipOptions: locations.map(l => ({ value: String(l.id), label: l.name })), emptyOptionsText: t('locations.detail.none') },
    { key: 'departmentId', label: t('contacts.detail.department'), type: 'chip-select',
      chipOptions: departments.map(d => ({ value: String(d.id), label: d.name })), emptyOptionsText: t('locations.detail.none') },
    { key: 'isPrimary', label: t('contacts.detail.primary'), type: 'checkbox' },
  ]

  const values = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    role: contact.role,
    email: contact.email,
    statusId: contact.statusId != null ? String(contact.statusId) : '',
    locationId: contact.locationId != null ? String(contact.locationId) : '',
    departmentId: contact.departmentId != null ? String(contact.departmentId) : '',
    isPrimary: contact.isPrimary,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(contact.id as Id, {
      firstName: v.firstName as string, lastName: v.lastName as string,
      role: v.role as string, email: v.email as string,
      statusId: (v.statusId as string) || null,
      locationId: (v.locationId as string) || null,
      departmentId: (v.departmentId as string) || null,
      isPrimary: Boolean(v.isPrimary),
    })
    setEditing(false)
  }

  const remove = () => confirm(t('contacts.deleteConfirm'), () => { onDelete(contact.id as Id); close() }, { danger: true })

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

      {/* Sub-tab strip only appears once there is a second sub-tab to show (Extra). */}
      {customFieldDefs.length > 0 && (
        <SubTabBar
          tabs={[
            { id: 'data',  label: t('contacts.detail.subtabs.data') },
            { id: 'extra', label: t('drawer.tabs.extra') },
          ]}
          active={subTab}
          onChange={id => setSubTab(id as typeof subTab)}
        />
      )}

      {subTab === 'data' && (
        <>
          <EditableFieldTable title={t('contacts.detail.infoTitle')} fields={fields} value={values} onSave={save}
            editing={editing} onStartEdit={() => setEditing(true)} onCancel={() => setEditing(false)} labelWidth={130} />

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
      {dialog}
    </div>
  )
}
