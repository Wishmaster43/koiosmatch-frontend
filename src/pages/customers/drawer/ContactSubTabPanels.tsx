/**
 * ContactSubTabPanels — the non-'data' sub-tab bodies of ContactDetail
 * (opportunities/tasks/conversations/extra/notes/linkedNotes/timeline/links).
 * §0.3 split (K-SIZE-SPLIT-A, mechanical extraction, no behavior change) —
 * lifted verbatim out of ContactDetail.tsx, which was over the ~400-line split
 * trigger (§3), mirroring DepartmentSubTabPanels/LocationSubTabPanels. 'data'
 * stays in ContactDetail itself (its own field card + text/consent/link
 * sections, not a scoped-list body like the ones below).
 * See ContactDetail's own docblock for the history behind every comment kept
 * below (SCOPED-LIST-TAB-1, GESPREK-CONTACT-1, CONTACT-NOTITIES-2, K-288, …).
 */
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import ScopedOpportunitiesTab from './ScopedOpportunitiesTab'
import ContactConversationsSection from './ContactConversationsSection'
import ContactNotesTab from './ContactNotesTab'
// K-288: linked-notes feed moved out of the Notities section into its own sub-tab.
import LinkedNotesTab from '@/components/drawer/tabs/notes/LinkedNotesTab'
// TIJDLIJN-SUBDRILL-1: the contact's own activity log (LOC-DEPT-CHANGELOG-1).
import SubEntityTimelineTab from './SubEntityTimelineTab'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'

type Tx = (key: string, opts?: Record<string, unknown>) => string
// K-288: 'linkedNotes' added right after 'notes' — the linked-notes feed's own sub-tab.
export type ContactSubTab = 'data' | 'opportunities' | 'tasks' | 'conversations' | 'extra' | 'notes' | 'linkedNotes' | 'timeline' | 'links'

// Renders the active non-'data' sub-tab body for ContactDetail.
export default function ContactSubTabPanels({ subTab, contact, customFieldsActive, showKoppelingen, canLinkBackoffice, onSave, t }: {
  subTab: ContactSubTab
  contact: Contact
  customFieldsActive: boolean
  showKoppelingen: boolean
  canLinkBackoffice: boolean
  onSave: (id: Id, payload: Record<string, unknown>) => void
  t: Tx
}) {
  return (
    <>
      {/* SCOPED-LIST-TAB-1: read-only, opens the real opportunity on row-click.
          customerId comes off the contact record itself (this component receives
          no separate customerId prop) — "+ Kans" stays hidden until it resolves.
          OPP-MODAL-PREFILL-1: unlike Location/DepartmentDetail, this file has no
          customerName in scope (Contact carries no such field and ContactDetail's
          own props don't thread one) — the "+ Kans" modal's customer-picker option
          label stays blank here. The customer/location/contact id itself still
          locks correctly; fixing the label would need a new prop threaded through
          ContactsPanel/CustomerDrawer, neither named in this task (§0 stay in scope). */}
      {subTab === 'opportunities' && (
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
          the ChangelogPopover/merge gating in ContactDetail (contact.customerId can be
          null on legacy/edge data), so the tab silently shows nothing rather than
          firing a /customers/undefined/… request. */}
      {subTab === 'conversations' && contact.customerId != null && (
        <ContactConversationsSection customerId={contact.customerId} contactId={contact.id as Id} mobile={contact.mobile} />
      )}

      {subTab === 'extra' && customFieldsActive && (
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
      {/* K-288: chain-linked notes naming this contact as principal (CMBE 64d976ff),
          now its own sub-tab instead of an inline section under Notities. */}
      {subTab === 'linkedNotes' && contact.customerId != null && (
        <LinkedNotesTab entity="customers" id={contact.customerId}
          sub={{ kind: 'contacts', id: contact.id as Id }} />
      )}
      {subTab === 'timeline' && contact.customerId != null && (
        <SubEntityTimelineTab endpoint={`/customers/${contact.customerId}/contacts/${contact.id}/activity`} />
      )}
      {subTab === 'links' && showKoppelingen && (
        <BackofficeLinksTab entity="contacts" id={contact.id as Id} helloflexLink={contact.helloflexLink} shiftmanagerLink={contact.shiftmanagerLink} canLink={canLinkBackoffice} />
      )}
    </>
  )
}
