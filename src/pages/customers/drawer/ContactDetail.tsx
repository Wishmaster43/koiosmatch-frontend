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
import { useTranslation } from 'react-i18next'
import { Trash2, Edit2, Save, X, GitMerge, Archive } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import Button from '@/components/ui/Button'
import TitleBadge from '@/components/drawer/TitleBadge'
import DrillPager, { type DrillPagerProps } from '@/components/drawer/DrillPager'
import ContactLinkSection from './ContactLinkSection'
import { emailValue, phoneValue, linkedinValue, LinkedinMark } from '@/components/drawer/contactLinks'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useBackofficeLinksVisible } from '@/components/drawer/useBackofficeLinksVisible'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './ChangelogTab'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import MergeContactModal from './MergeContactModal'
// SCOPED-LIST-TAB-1: this contact's own Kansen sub-tab, mirrors Location/
// DepartmentDetail's identical wiring (§3A — shared config-driven tab, never a forked copy).
import ScopedOpportunitiesTab from './ScopedOpportunitiesTab'
// GESPREK-CONTACT-1: this contact's own Conversaties sub-tab — thin wrapper over the
// shared components/drawer/ConversationsSection, pointed at the nested contact route.
import ContactConversationsSection from './ContactConversationsSection'
// CONTACT-NOTITIES-2: this contact's own Notities sub-tab, mirrors ScopedNotesTab's
// identical wiring (§3A — shared notes-tab family, never a forked composer/list).
import ContactNotesTab from './ContactNotesTab'
import { useCustomFields } from '@/lib/useCustomFields'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { useGenders } from '@/lib/useGenders'
import { useConfirm } from '@/hooks/useConfirm'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { archiveContact, restoreContact } from '../hooks/useCustomerContacts'
import { useSubEntityArchive } from '../hooks/useSubEntityArchive'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'


export default function ContactDetail({ contact, locations, departments, statuses, existing = [], canLinkBackoffice = false, pager, onSave, onDelete, close, onMerged }: {
  contact: Contact
  locations: { id: Id; name: string }[]
  departments: Department[]
  statuses: LookupOption[]
  /** The customer's OTHER contacts — needed to spot the current primary before replacing it. */
  existing?: Contact[]
  // EXTRACT-1: the caller's own customers.update permission check for the
  // Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  /** Prev/next through the caller's OWN filtered rows (DRILL-PAGER-1) — absent when
   * the open contact fell out of that filtered set (nothing sane to page to). */
  pager?: DrillPagerProps
  onSave: (id: Id, payload: Partial<ContactPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
  /** Called with the SURVIVOR's id after a merge, so the host can open that record. */
  onMerged?: (survivorId: Id) => void
}) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
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
  // DD-FE-6 ("no empty tabs"): this file passes no extra children into
  // BackofficeLinksTab, so the Koppelingen sub-tab is genuinely empty (no card,
  // no "Koppelen" button) unless at least one connector app is enabled.
  const showKoppelingen = useBackofficeLinksVisible()
  // SCOPED-LIST-TAB-1/GESPREK-CONTACT-1 added 'kansen'/'conversations', right after
  // Gegevens and Taken respectively (§3A — same shared tabs Location/DepartmentDetail carry).
  // CONTACT-NOTITIES-2: 'notes' joins right before 'koppelingen' (tab-order canon, §3A).
  const [subTab, setSubTab] = useState<'data' | 'kansen' | 'tasks' | 'conversations' | 'extra' | 'notes' | 'koppelingen'>('data')
  // Contact function (job title) is a lookup combobox, split from the candidate
  // function list (FUNCTIONS-SPLIT-1) — never a plain free-text field.
  const { contactFunctions, allowFreeEntry } = useContactFunctions()
  // CONTACT-GESLACHT-1: the SAME tenant /genders lookup a candidate uses — three
  // hardcoded options would be a second, drifting vocabulary.
  const { genders } = useGenders()
  // Merge is destructive and irreversible, so it is permission-gated in the UI
  // (customers.update — the route's own middleware; the backend re-checks anyway, §7).
  const auth = useAuth()
  const canMerge = (auth?.hasPermission ?? (() => false))('customers.update')
  const [merging, setMerging] = useState(false)

  // Location/department are no longer in this table — see the Koppeling block
  // below (file header BUG FIX 28-07): a chip-select field can't cascade off
  // another field's live draft value, so they need their own cascading picker.
  // ONE card for the person (Danny 28-07: "telefoonnummers en contactpersoon moeten
  // samen"). The numbers used to need their own card because they carry per-field icon
  // affordances — that is what FieldRow.renderValue is for now, so they are plain rows
  // here and the second card is gone. Status is NOT a row: it is the title-row badge
  // below, exactly like a location (§3A(c) — the header shows state, the card shows data).
  const fields: FieldRow[] = [
    // NAME-COMPOSITE-1 (Danny 05-08: "voornaam, tussenvoegsel en achternaam tonen
    // als 1 regel; alleen bij het potloodje zijn het er 3") — one composed line in
    // read mode, the three loose fields only while editing. Mirrors the shared
    // EditableFieldTable 'address' composite (see its own doc comment).
    { key: 'name', label: t('contacts.detail.name'), type: 'name',
      nameFields: [
        { key: 'firstName', label: t('subModal.firstName'), type: 'text' },
        // CONTACT-TUSSENVOEGSEL-1: editing a contact used to drop this silently.
        { key: 'middleName', label: t('contacts.detail.middleName'), type: 'text' },
        { key: 'lastName', label: t('subModal.lastName'), type: 'text' },
      ] },
    // Gender stores the lookup VALUE SLUG; the read view resolves its label below.
    { key: 'gender', label: t('contacts.detail.gender'), type: 'creatable', allowCreate: false,
      options: genders.map(g => ({ value: g.value, label: g.label })),
      renderValue: v => {
        const slug = String(v ?? '')
        const hit = genders.find(g => g.value === slug || g.label === slug)
        return <span style={{ color: slug ? 'var(--text)' : 'var(--text-muted)' }}>{hit?.label ?? slug ?? '—'}</span>
      } },
    { key: 'role', label: t('contacts.detail.role'), type: 'creatable', options: contactFunctions, allowCreate: allowFreeEntry },
    { key: 'email', label: t('contacts.detail.email'), type: 'text',
      renderValue: v => emailValue(v, t('contacts.detail.email')) },
    // The WhatsApp shortcut belongs to the MOBILE number only — a landline cannot hold a
    // conversation, so offering it there would be a control that goes nowhere.
    { key: 'mobile', label: t('contacts.detail.mobile'), type: 'text',
      renderValue: v => phoneValue(v, t('contacts.detail.callPhone'), { label: t('contacts.detail.whatsapp') }) },
    { key: 'phone', label: t('contacts.detail.phone'), type: 'text',
      renderValue: v => phoneValue(v, t('contacts.detail.callPhone')) },
    // CONTACT-LINKEDIN-1 (Danny 05-08): the backend stores only the slug; the read
    // view links out to linkedin.com/in/{slug} (mirrors email/phone above). Label
    // carries the brand mark, exactly like the candidate's own LinkedIn row.
    { key: 'linkedin', label: <><LinkedinMark size={12} />{t('contacts.detail.linkedin')}</>, type: 'text',
      renderValue: v => linkedinValue(v, t('contacts.detail.openLinkedin')) },
    { key: 'isPrimary', label: t('contacts.detail.primary'), type: 'checkbox' },
  ]

  const values = {
    firstName: contact.firstName,
    middleName: contact.middleName,
    lastName: contact.lastName,
    gender: contact.gender,
    role: contact.role,
    email: contact.email,
    mobile: contact.mobile,
    phone: contact.phone,
    linkedin: contact.linkedin ?? '',
    isPrimary: contact.isPrimary,
  }

  // The customer's current primary, if it is someone else — the backend silently
  // demotes them when this contact is saved as primary, so we ask first.
  const currentPrimary = existing.find(c => c.isPrimary && String(c.id) !== String(contact.id))

  const save = (v: Record<string, unknown>) => {
    const commit = (isPrimary: boolean) => {
      onSave(contact.id as Id, {
        firstName: v.firstName as string, middleName: v.middleName as string, lastName: v.lastName as string,
        gender: v.gender as string,
        role: v.role as string, email: v.email as string,
        mobile: v.mobile as string, phone: v.phone as string,
        linkedin: v.linkedin as string,
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

  const remove = () => confirm(t('contacts.deleteConfirm'), () => { onDelete(contact.id as Id); close() }, { danger: true })

  // ARCHIVE-SUBENTITY-1: the shared mutation hook (§11 — mirrors Location/
  // DepartmentDetail's identical wiring). No InUseCountsDialog wiring here — a
  // contact delete has no honest disabled-trash/409-race dialog built yet, so
  // there is no dead end to offer an escape from (measured: `remove` above
  // fires unconditionally, unlike the location/department trash button).
  const { archiving, archiveNow, doRestore } = useSubEntityArchive({
    customerId: contact.customerId ?? undefined, id: contact.id as Id, archiveFn: archiveContact, restoreFn: restoreContact, onDone: close,
    archiveFailedMessage: t('contacts.detail.archiveFailed'), restoreFailedMessage: t('contacts.detail.restoreFailed'),
  })
  const doArchive = () => confirm(t('contacts.detail.confirmArchive', { name: contact.name }), archiveNow)

  // Location/department coupling — own self-contained edit block (pencil →
  // save/cancel), cascading exactly like AddContactPersonModal (file header
  // BUG FIX 28-07): empty-until-a-location-is-picked, and picking a new
  // location always clears the department (a department belongs to exactly
  // one location, so any location change invalidates the previous pick).
  // Coupling — the shared +Vestiging-shaped section (Danny 28-07). Saving is immediate,
  // like the branch picker: pick and it is stored, remove the chip and it is cleared.
  const saveLink = (patch: { locationIds?: Id[]; departmentIds?: Id[] }) =>
    onSave(contact.id as Id, patch)

  // Array OR singular, same rule the list uses: the pivots are near-empty today, so a
  // contact whose only link is the legacy singular id must still show that link here.
  const linkedLocationIds = contact.locations.length > 0
    ? contact.locations.map(l => l.id)
    : (contact.locationId != null ? [contact.locationId] : [])
  const linkedDepartmentIds = contact.departments.length > 0
    ? contact.departments.map(d => d.id)
    : (contact.departmentId != null ? [contact.departmentId] : [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Title row, same anatomy as a customer and a location (§3A(c)): name, the
          copyable reference number, then the STATUS as a read-only colour badge with its
          own pencil. Status is not a field-table row here — Danny 28-07: "bij de
          contactpersoon staat status in de tabel en niet naast de naam zoals bij
          locaties, we moeten het consistent houden". */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen customer-drawer zone (Danny 08-08): this title is 15/700 where PageTitle is 15/600 — converting is a visible restyle, so it waits for the drawer revisit, not a sweep */}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{contact.name}</div>
          <ReferenceNumberChip value={contact.referenceNumber} />
          {editingStatus ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 170 }}>
                <CreatableSelect value={statusDraft} onChange={setStatusDraft} allowCreate={false} menuWidth={180}
                  placeholder={t('locations.detail.status')}
                  options={statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))} />
              </div>
              <Button variant="primary" iconOnly size="sm" onClick={saveStatus} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
              <Button variant="secondary" iconOnly size="sm" onClick={() => setEditingStatus(false)} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
            </div>
          ) : (
            <>
              <TitleBadge label={contact.statusLabel} color={contact.statusColor} />
              <Button variant="secondary" iconOnly size="sm" onClick={startEditStatus} title={t('locations.detail.changeStatus')} aria-label={t('locations.detail.changeStatus')}><Edit2 size={13} /></Button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Prev/next through the list this contact was opened from (DRILL-PAGER-1) —
              before the merge/delete actions, same corner as every other detail pager. */}
          {pager && <DrillPager {...pager} />}
          {/* LOC-DEPT-CHANGELOG-1: record history is an icon-popover in the title row,
              never a tab (§3A(d)) — reuses the shared customer ChangelogTab content
              with its own one-level-deeper endpoint. */}
          {contact.customerId != null && (
            <ChangelogPopover><ChangelogTab endpoint={`/customers/${contact.customerId}/contacts/${contact.id}/activity`} /></ChangelogPopover>
          )}
          {/* Merge — title-row action, exactly like the candidate drawer (§3A). Hidden
              without customers.update and when this customer has no second contact to
              merge with: a button that can only ever fail is a fake affordance. */}
          {canMerge && contact.customerId != null && existing.length > 1 && (
            <Button variant="secondary" iconOnly size="sm" onClick={() => setMerging(true)} title={t('contacts.merge.title')} aria-label={t('contacts.merge.title')}>
              <GitMerge size={13} />
            </Button>
          )}
          {/* Archive: house secondary chrome; only the ICON colour is the archive token,
              which rides in as a style override. Button merges caller style last EXCEPT
              while disabled — the grey disabled recipe deliberately wins then (20-08),
              which is right here too: in-flight archiving should look inert. Gated on
              `canMerge` (Archive is update-class too, §5). */}
          {canMerge && !contact.archived && (
            <Button variant="secondary" iconOnly size="sm" onClick={doArchive} disabled={archiving}
              title={t('contacts.detail.archiveContact')} aria-label={t('contacts.detail.archiveContact')}
              style={{ color: 'var(--color-archive)' }}>
              <Archive size={13} />
            </Button>
          )}
          <Button variant="dangerSoft" iconOnly size="sm" onClick={remove} title={t('common:delete')} aria-label={t('common:delete')}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* ARCHIVE-SUBENTITY-1: the in-body archived state, right under the title row. */}
      {contact.archived && (
        <ArchivedBanner id={contact.id} onRestore={doRestore}
          message={contact.archivedAt ? t('contacts.archivedBanner.since', { date: formatDate(contact.archivedAt) }) : t('contacts.archivedBanner.flag')}
          restoreLabel={t('contacts.archivedBanner.restore')} />
      )}

      {/* Sub-tab strip — DD-FE-6 ("no empty tabs"): Koppelingen only lists when a
          connector app is enabled (its body would otherwise render nothing);
          Extra still only appears with ≥1 active custom field. */}
      <SubTabBar
        tabs={[
          { id: 'data',  label: t('contacts.detail.subtabs.data') },
          // SCOPED-LIST-TAB-1: reuses the existing top-level drawer.tabs.opportunities
          // key (already five-locale complete) — same shared label Location/DepartmentDetail use.
          { id: 'kansen', label: t('drawer.tabs.opportunities') },
          { id: 'tasks', label: t('contacts.detail.subtabs.tasks') },
          // GESPREK-CONTACT-1: local-only label, mirrors the 'data'/'tasks' siblings above.
          { id: 'conversations', label: t('contacts.detail.subtabs.conversations') },
          ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
          // CONTACT-NOTITIES-2: always visible (mirrors the 'data'/'tasks' siblings,
          // never gated on data presence) and BEFORE 'koppelingen', per tab-order canon.
          { id: 'notes', label: t('contacts.detail.subtabs.notes') },
          ...(showKoppelingen ? [{ id: 'koppelingen', label: t('common:backofficeLinks.tabLabel') }] : []),
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {subTab === 'data' && (
        <>
          {/* CANON-DIVIDER-1 (Danny 05-08): candidate ProfileTab canon — no line
              between rows, 11px labels. */}
          {/* Canon width (fieldRowCanon, 05-08): EditableFieldTable's own default now matches. */}
          <EditableFieldTable key={tableEpoch} title={t('contacts.detail.infoTitle')} fields={fields} value={values} onSave={save}
            editing={editing} onStartEdit={() => setEditing(true)} onCancel={() => setEditing(false)} />

          {/* Koppeling — same shape and behaviour as "+ Vestiging" (Danny 28-07). */}
          <ContactLinkSection locationIds={linkedLocationIds} departmentIds={linkedDepartmentIds}
            locations={locations} departments={departments} onChange={saveLink} />

        </>
      )}

      {/* SCOPED-LIST-TAB-1: read-only, opens the real opportunity on row-click.
          customerId comes off the contact record itself (this component receives
          no separate customerId prop) — "+ Kans" stays hidden until it resolves.
          OPP-MODAL-PREFILL-1: unlike Location/DepartmentDetail, this file has no
          customerName in scope (Contact carries no such field and ContactDetail's
          own props don't thread one) — the "+ Kans" modal's customer-picker option
          label stays blank here. The customer/location/contact id itself still
          locks correctly; fixing the label would need a new prop threaded through
          ContactsPanel/CustomerDrawer, neither named in this task (§0 stay in scope). */}
      {subTab === 'kansen' && (
        <ScopedOpportunitiesTab scope="contact" id={contact.id} customerId={contact.customerId ?? undefined} />
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
            // TAKEN-TOOLBAR-2: open/history dropped — the shared tab now filters by
            // real task status (StatusFilterSelect), not a hardcoded open/history split.
            newTask: t('contacts.tasks.newTask'),
            empty: t('contacts.tasks.empty'), loading: t('contacts.tasks.loading'), error: t('contacts.tasks.error'),
            openTask: t('contacts.tasks.openTask'), searchPlaceholder: t('contacts.tasks.searchPlaceholder'),
          }}
        />
      )}

      {/* GESPREK-CONTACT-1: the nested contact route needs a real customerId — mirrors
          the ChangelogPopover/merge gating above (contact.customerId can be null on
          legacy/edge data), so the tab silently shows nothing rather than firing a
          /customers/undefined/… request. */}
      {subTab === 'conversations' && contact.customerId != null && (
        <ContactConversationsSection customerId={contact.customerId} contactId={contact.id as Id} />
      )}

      {subTab === 'extra' && customFieldDefs.length > 0 && (
        <CustomFieldsTab entityType="customer_contact" values={contact.customFields ?? {}}
          onSave={patch => onSave(contact.id as Id, { customFields: { ...contact.customFields, ...patch } })} />
      )}
      {/* CONTACT-NOTITIES-2: this contact's own notes, filtered client-side against
          the customer's own notes list (no dedicated scoped endpoint exists yet —
          see useContactNotes' docblock). customerId can be null on legacy/edge data
          (mirrors the conversations/changelog gating above). */}
      {subTab === 'notes' && contact.customerId != null && (
        <ContactNotesTab contactId={contact.id as Id} customerId={contact.customerId} />
      )}
      {subTab === 'koppelingen' && showKoppelingen && (
        <BackofficeLinksTab entity="contacts" id={contact.id as Id} helloflexLink={contact.helloflexLink} shiftmanagerLink={contact.shiftmanagerLink} canLink={canLinkBackoffice} />
      )}
      {/* `existing` is the CUSTOMER-WIDE list, which is exactly the set the scoped merge
          route can resolve — a contact from another customer is a 404 by design. */}
      {merging && contact.customerId != null && (
        <MergeContactModal customerId={contact.customerId} current={contact} others={existing}
          onClose={() => setMerging(false)}
          onMerged={survivorId => { setMerging(false); onMerged?.(survivorId) }} />
      )}
      {dialog}
    </div>
  )
}
