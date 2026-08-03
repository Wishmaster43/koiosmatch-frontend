/**
 * DepartmentDetail — the Afdelingen-tab drill-down. Danny 2026-07-14: reorganised
 * into SUB-TABS (short labels, mirrors LocationDetail/the candidate Communicatie
 * sub-tab bar) — Gegevens (name/location/status + the Omschrijving rich-text
 * block) · Contactpersonen — default Gegevens. Full edit via the shared
 * EditableFieldTable house pattern (pencil → save/cancel): name, location (movable
 * per CustomerDepartmentController — `location_id` is `sometimes` on update),
 * cost centre (Danny 2026-07-22 — the middle cascade level; billing email
 * stays customer-only, see OverviewTab). Omschrijving is its own rich-text block
 * (EditableRichTextField — own
 * pencil/save/cancel, RichTextEditor + SafeHtml), same pattern as the customer's
 * Teksten section — a bare textarea is no longer the house pattern for prose.
 * Delete asks for confirmation and fails soft (409 = in use) via the hook's own
 * toast. Nested contacts-in-this-department stay read-only here (full contact
 * management lives on the Contactpersonen tab / location detail).
 *
 * PARITY-DEPARTMENT-1 (2026-08-02, Danny: "Afdeling loopt achter — zorg ervoor
 * dat de huisstijl klopt"): brought this drill-down in line with LocationDetail,
 * the §3A reference — reference-number chip + a colour-coded title-row status
 * badge with its own inline picker (JOB-STATUS-1, status removed from the field
 * table), Omschrijving moved ahead of the field table, and a Koios advice block
 * over this department's own fields. The Koios builder lives INLINE below (not a
 * sibling file like locationAiInsights.ts) because this task's scope locks
 * changes to this file + its test only. LocationContactSection/
 * LocationBranchSection (contact block, branch coupling) are deliberately NOT
 * mirrored — a department has no address of its own and the location's contact
 * block is mid-redesign in another lane.
 *
 * NOT mirrored, verified: LocationDetail titles its field cards (group names
 * "Details"/"Adres") even though its own sub-tab is "Adres & gegevens" — a
 * DIFFERENT, compound string, so no collision. This department's sub-tab is the
 * short label `departments.detail.subtabs.data`, which is the SAME string as the
 * candidate group title `overview.details` in nl/en/es ("Gegevens"/"Details"/
 * "Datos" — checked all five locales). Titling this card would duplicate the
 * sub-tab label AND breaks DepartmentsPanel.test.tsx's `getByText` assertion
 * (that file is committed-clean and out of scope here) — so the field table
 * below intentionally keeps `title=""`, unlike the location.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Edit2, Save, X } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import TitleBadge from '@/components/drawer/TitleBadge'
import CreatableSelect from '@/components/ui/CreatableSelect'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import ContactsPanel from './ContactsPanel'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import type { Crumb } from '@/components/drawer/DrillBreadcrumb'
import EditableRichTextField from './EditableRichTextField'
import { useCustomFields } from '@/lib/useCustomFields'
import { useConfirm } from '@/hooks/useConfirm'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

// A bound-namespace translate function (mirrors locationAiInsights.ts/customerAiInsights.ts).
type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildDepartmentAdviceInsights — Koios advice for THIS department's own fields
 * (description/status/cost centre; name is required so it carries no signal).
 * Pure FE completeness heuristics, no AI/API call — mirrors
 * buildLocationAdviceInsights next to LocationDetail, kept inline here per the
 * PARITY-DEPARTMENT-1 scope note above.
 */
function buildDepartmentAdviceInsights(d: Department, t: Tx): KoiosAdviceInsight[] {
  const coreFields = [d.description, d.statusId, d.costCenter]
  const filledPct = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)
  return [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.departmentComplete') : t('ai.departmentPartial', { pct: filledPct }),
    },
  ]
}

export default function DepartmentDetail({ department, locations, statuses, contactStatuses = [], departments = [], contacts = [], canLinkBackoffice = false, trail = [], onAddContact, onUpdateContact, onRemoveContact, onSave, onDelete, close }: {
  department: Department
  locations: { id: Id; name: string }[]
  statuses: LookupOption[]
  // The customer's contacts filtered to this department by the caller (the resource
  // itself doesn't embed contacts — CustomerDepartmentResource has no `contacts` field).
  contacts?: Contact[]
  // EXTRACT-1: the caller's own customers.update permission check for the
  // Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  /** Lookups + writers the shared ContactsPanel needs (same set the location gets). */
  contactStatuses?: LookupOption[]
  departments?: Department[]
  /**
   * The clickable ancestors above this department. A department opened from the customer
   * tab gets one crumb ("Afdelingen"); one opened inside a location gets two
   * ("Locaties › Vestiging Noord"), so every hop stays one click — the same trail a
   * contact gets. A single folded label would make the ancestors read as text.
   */
  trail?: Crumb[]
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  onRemoveContact: (id: Id) => void
  onSave: (id: Id, payload: Partial<DepartmentPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
}) {
  const { t } = useTranslation('customers')
  // A contact opened from this department's own list takes over the body (see LocationDetail).
  const [openContactId, setOpenContactId] = useState<Id | null>(null)
  const contactOpen = openContactId != null

  const { confirm, dialog } = useConfirm()
  // The Extra sub-tab only shows when the tenant has defined customer_department custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_department')
  // Sub-tabs (short labels, Danny 2026-07-14) — default Gegevens.
  const [subTab, setSubTab] = useState<'data' | 'contacts' | 'extra' | 'koppelingen'>('data')

  // JOB-STATUS-1 (mirrors LocationDetail): status options for the title-row picker.
  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))

  // Description lives in its own rich-text block below (EditableRichTextField), and
  // status now lives in the title-row badge (see render below) — neither is a row
  // in this field-table anymore. Kostenplaats (Danny 2026-07-22) is the
  // middle cascade level (afdeling > locatie > klant) — no billing email here,
  // facturatie always comes from the customer (see OverviewTab).
  const fields: FieldRow[] = [
    { key: 'name', label: t('departments.detail.name'), type: 'text' },
    { key: 'locationId', label: t('departments.detail.location'), type: 'select', options: locations.map(l => ({ value: String(l.id), label: l.name })) },
    { key: 'costCenter', label: t('departments.detail.costCenter'), type: 'text' },
  ]

  // The read/edit values keyed like the fields above; locationId compares as a string.
  const values = {
    name: department.name,
    locationId: department.locationId != null ? String(department.locationId) : '',
    costCenter: department.costCenter,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(department.id as Id, {
      name: v.name as string, locationId: v.locationId as string,
      costCenter: v.costCenter as string,
    })
  }
  const saveDescription = (html: string) => onSave(department.id as Id, { description: html })

  // JOB-STATUS-1: the title-row status badge's own inline edit — pencil toggles to
  // a searchable CreatableSelect + save/cancel (same in-place-edit convention as
  // EditableFieldTable/EditableRichTextField, §3A), independent of the general
  // fields' own save cycle since status now lives entirely in the title row.
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const startEditStatus = () => { setStatusDraft(department.statusId != null ? String(department.statusId) : ''); setEditingStatus(true) }
  const saveStatus = () => { onSave(department.id as Id, { statusId: statusDraft || null }); setEditingStatus(false) }
  const cancelStatus = () => setEditingStatus(false)
  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

  const remove = () => confirm(t('departments.deleteConfirm'), () => { onDelete(department.id as Id); close() }, { danger: true })

  // A contact opened from this department's list brings its own full trail, so the
  // department steps aside — one title, one delete button, one way back.
  if (contactOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* `trail` carries only the ANCESTORS: ContactsPanel appends this department itself
            as its own list crumb (its scopeName IS department.name), so passing it here too
            printed "Dagbesteding › Dagbesteding" — measured live 28-07. */}
        <ContactsPanel scope="department" scopeId={department.id as Id} scopeName={department.name}
          contacts={contacts} locations={locations} departments={departments} statuses={contactStatuses}
          trail={trail}
          openId={openContactId} onOpenChange={setOpenContactId}
          onAdd={onAddContact} onUpdate={onUpdateContact} onRemove={onRemoveContact} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* One way back per level (see LocationDetail for why this replaced the old button). */}
      <DrillBreadcrumb trail={trail} current={department.name} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{department.name}</div>
          {/* NUMMER-1: the human-readable reference number chip, same spot every entity shows it. */}
          <ReferenceNumberChip value={department.referenceNumber} />
          {editingStatus ? (
            // Inline picker in the title row (JOB-STATUS-1, mirrors LocationDetail) —
            // searchable, pick-only (allowCreate off, same as every tenant-lookup select).
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 170 }}>
                <CreatableSelect value={statusDraft} onChange={setStatusDraft} options={statusOptions}
                  placeholder={t('locations.detail.status')} allowCreate={false} menuWidth={180} />
              </div>
              <button onClick={saveStatus} title={t('common:save')} aria-label={t('common:save')}
                // No --color-primary-contrast token exists yet (tracked for a later
                // sweep); the fallback keeps this identical to the shared
                // EditableFieldTable's own Save button today.
                style={{ ...iconBtn, background: 'var(--color-primary)', color: 'var(--color-primary-contrast, #fff)', border: 'none' }}><Save size={13} /></button>
              <button onClick={cancelStatus} title={t('common:cancel')} aria-label={t('common:cancel')}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
            </div>
          ) : (
            <>
              {/* Status = colour-coded read-only badge next to the title (§3A(c)), not a
                  select row in the field table — the pencil reopens the picker above. */}
              <TitleBadge label={department.statusLabel} color={department.statusColor} />
              <button onClick={startEditStatus} title={t('locations.detail.changeStatus')} aria-label={t('locations.detail.changeStatus')}
                style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
            </>
          )}
        </div>
        <button onClick={remove} title={t('common:delete')}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--color-danger)', flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Sub-tab strip — same shared bar as LocationDetail / the candidate Communicatie tab. */}
      <SubTabBar
        tabs={[
          { id: 'data',     label: t('departments.detail.subtabs.data') },
          { id: 'contacts', label: t('drawer.tabs.contacts') },
          ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
          // EXTRACT-1: the shared Koppelingen sub-tab, always last (§3A/§11).
          { id: 'koppelingen', label: t('common:backofficeLinks.tabLabel') },
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {subTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* No repeated title (verified, unlike LocationDetail — see the file header
              comment): this sub-tab's own label already IS "Gegevens"/"Details" in
              three of five locales, identical to the group title, so a card title
              here would duplicate it AND collide with DepartmentsPanel.test.tsx's
              getByText on that sub-tab label. */}
          <EditableFieldTable title="" fields={fields} value={values} onSave={save} labelWidth={130} />

          {/* Omschrijving AFTER the data blocks — Danny 02-08: every entity's prose block
              follows the customer Bedrijf-tab order (fields → text → Koios), so the
              earlier description-first placement was reversed on both location and here. */}
          <EditableRichTextField label={t('departments.detail.description')} value={department.description ?? ''} onSave={saveDescription} />

          {/* Koios advice — pure FE completeness heuristics over this department's OWN
              fields, same slot LocationDetail/OverviewTab put it in (right after the
              text block, before any nested-entity sections). No API call. */}
          <KoiosAdviceBlock namespace="customers" insights={buildDepartmentAdviceInsights(department, t)} />
        </div>
      )}

      {subTab === 'extra' && (
        <CustomFieldsTab entityType="customer_department" values={department.customFields ?? {}}
          onSave={patch => onSave(department.id as Id, { customFields: { ...department.customFields, ...patch } })} />
      )}

      {subTab === 'koppelingen' && (
        <BackofficeLinksTab entity="departments" id={department.id as Id} helloflexLink={department.helloflexLink} shiftmanagerLink={department.shiftmanagerLink} canLink={canLinkBackoffice} />
      )}

      {/* The SAME panel the customer tab and a location render — one contact surface.
          `trail` carries only the ANCESTORS: the panel appends this department itself as its
          own list crumb (its scopeName IS department.name). */}
      {subTab === 'contacts' && (
        <ContactsPanel scope="department" scopeId={department.id as Id} scopeName={department.name}
          contacts={contacts} locations={locations} departments={departments} statuses={contactStatuses}
          trail={trail}
          openId={openContactId} onOpenChange={setOpenContactId}
          onAdd={onAddContact} onUpdate={onUpdateContact} onRemove={onRemoveContact} />
      )}
      {dialog}
    </div>
  )
}
