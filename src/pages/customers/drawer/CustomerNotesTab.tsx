/**
 * CustomerNotesTab — the Communicatie tab's sub-tabs (mirrors candidates/drawer/
 * CommunicationTab.tsx): Notities · Tijdlijn · Vacature-zichtbaarheid. The last one
 * joined on Danny's 28-07 correction ("vacature zichtbaarheid zetten we als sub tabje
 * onder communicatie") — it was briefly a top-level tab. The shared NotesTab renders once
 * per sub-tab via its show* flags, exactly like the candidate tab — same
 * composer, same note-card look (type chip + author + pencil).
 *
 * "Gesprekken" is deliberately NOT included: NotesTab's conversations section
 * is a permanent stub across the WHOLE app today (no `conversations` data prop
 * exists anywhere, just a fixed empty-state string) — there is no customer (or
 * any entity) conversations endpoint yet, so adding the sub-tab would only ever
 * render empty. Report this as a finding, not a customer-specific gap.
 *
 * Tijdlijn is fed from the SAME audit-trail endpoint the changelog-icon popover
 * already uses (GET /customers/{id}/activity) — Customer carries no separate
 * embedded `timeline` array the way Candidate does (candidates get theirs
 * straight from GET /candidates/{id}).
 *
 * NO task trigger here (Danny 28-07: "+ nieuwe taak moet weg, hoort hier niet"). It sat
 * on this tab only because GET /tasks?customer={id} used to ignore its filter, so a real
 * Taken tab could not be built and a create-only button was the most that was honest.
 * That filter works now (TASKS-LINK-FILTER-1), so tasks belong in their own tab on the
 * customer — not bolted onto Notities.
 */
import { useState, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import SubTabBar from '@/components/drawer/SubTabBar'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import VacancySettingsTab from './VacancySettingsTab'
import SelectMenu from '@/components/ui/SelectMenu'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { contactOptionLabel } from '@/lib/contactLabel'
import type { Id } from '@/types/common'
import type { Customer, CustomerNote } from '@/types/customer'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helper — accept any props at the boundary (mirrors CommunicationTab).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

interface TimelineEntry { time?: string; text?: string }
interface ActivityEntry { description?: string; action?: string; created_at?: string }

interface Props {
  customerId: Id | undefined
  // Timeline identity — the customer itself (mirrors the candidate tab's own
  // timelineName/timelineInitials, which are the CANDIDATE's, not the author's).
  customerName?: string
  customerInitials?: string
  // Fallback avatar for a note with no resolved author on the API row — the
  // signed-in user (mirrors the previous inline NotesTab usage in this drawer).
  authorInitials?: string
  notes: CustomerNote[]
  // CONTACT-NOTITIES-1 (Danny quick win): `customer_contact_id` rides along as an
  // optional extra field — widened from `{ type, title, body }` only; the plain
  // `(id, payload: { type, title, body }) => void` the parent (CustomerDrawer)
  // still declares stays assignable here (a variable of THIS wider shape is
  // always assignable where the narrower one is expected).
  onAddNote?: (payload: { type: string; title: string; body: string; customer_contact_id?: Id }) => void
  // The record itself + its save path, for the Vacature-zichtbaarheid sub-tab (it edits
  // three customer fields through the drawer's own optimistic PATCH).
  c: Customer
  onSave?: (values: Record<string, unknown>) => void
}

export default function CustomerNotesTab({ customerId, customerName, customerInitials, authorInitials, notes, onAddNote, c, onSave }: Props) {
  const { t } = useTranslation('customers')
  // Note categories from the tenant lookup (NOTE-TYPES-2/3). CustomerController::
  // addNote validates `type` against entity=contact when customer_contact_id is
  // filled, entity=customer otherwise (NOTE-TYPES-3-GAP-1) — so the composer
  // must offer the MATCHING scope's writable types, picked below on the linked
  // contact selection, never always the customer ones.
  const { writableTypes: customerNoteTypes, types: customerChipTypes } = useNoteTypes('customer')
  const { writableTypes: contactNoteTypes, types: contactChipTypes } = useNoteTypes('contact')
  const [subTab, setSubTab] = useState('notes')
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const active = subTab

  // CONTACT-NOTITIES-1 (Danny quick win): optionally file the next note against
  // one of this customer's own contacts — the API already accepts
  // `customer_contact_id` (scoped to this customer, CustomerController::addNote)
  // but nothing offered picking one. Resets after each save (see handleAddNote)
  // so linking one note never silently carries over onto the next, unrelated one.
  const [pendingContactId, setPendingContactId] = useState('')
  const contactOptions = (c.contacts ?? [])
    .filter(contact => contact.id != null)
    .map(contact => ({ value: String(contact.id), label: contactOptionLabel(contact) }))
  const noteTypes = pendingContactId ? contactNoteTypes : customerNoteTypes
  // Historical notes may have been filed under EITHER scope — merge both lookups
  // (deduped by value) so an existing note's type chip always resolves its real
  // label/colour regardless of which scope it was written under.
  const chipTypes = [...customerChipTypes, ...contactChipTypes]
    .filter((nt, i, arr) => arr.findIndex(x => x.value === nt.value) === i)

  // Carries the picked contact link along with the composer's own payload, then
  // clears the picker — a fresh note starts unlinked unless picked again.
  const handleAddNote = (payload: { type: string; title: string; body: string }) => {
    onAddNote?.({ ...payload, customer_contact_id: pendingContactId || undefined })
    setPendingContactId('')
  }

  // Soft-tint "linked to {contact}" chip (§4 convention). The shared NotesTab
  // (components/drawer/tabs/NotesTab.tsx) has no per-note extension point and is
  // out of scope for this change (owned by a parallel lane) — but its title cell
  // already renders whatever ReactNode it is given (`{n.title ?? who}`), so this
  // stays entirely inside THIS file: a note with a linked contact gets this chip
  // AS its title, never a change to the shared component.
  const contactChip = (name: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
      padding: '1px 6px', borderRadius: 99, marginRight: 6,
      background: 'color-mix(in srgb, var(--color-info) 12%, transparent)', color: 'var(--color-info)',
      border: '1px solid color-mix(in srgb, var(--color-info) 40%, transparent)' }}>
      {t('notes.linkedTo', { name })}
    </span>
  )
  // Notes with a linked contact show the chip where the (never-persisted) title
  // would sit; every other note is untouched.
  const notesWithChip: Array<Omit<CustomerNote, 'title'> & { title: ReactNode }> = notes.map(n =>
    n.contactName ? { ...n, title: contactChip(n.contactName) } : n)

  // Fetch the activity feed lazily, only once the Tijdlijn sub-tab is opened.
  useEffect(() => {
    if (active !== 'timeline' || !customerId) return
    const ctrl = new AbortController()
    api.get(`/customers/${customerId}/activity`, { signal: ctrl.signal })
      .then(r => setTimeline(((unwrapList(r).rows) as ActivityEntry[])
        .map(ev => ({ time: ev.created_at, text: ev.description ?? ev.action ?? '' }))))
      .catch(e => { if (!isAbortError(e)) setTimeline([]) })
    return () => ctrl.abort()
  }, [active, customerId])

  // Shared NotesTab props — each sub-tab renders exactly one of its sections.
  const notesProps = {
    notes: notesWithChip, onAddNote: handleAddNote, timeline, noteTypes, chipTypes,
    authorInitials, timelineName: customerName, timelineInitials: customerInitials,

    labels: {
      notes: t('notes.notes'), newNote: t('notes.newNote'), type: t('notes.type'),
      save: t('notes.save'), cancel: t('notes.cancel'), edit: t('notes.edit'),
      notesEmpty: t('notes.notesEmpty'), timeline: t('notes.timeline'), timelineEmpty: t('notes.timelineEmpty'),
      notePlaceholder: () => t('notes.notePlaceholder'),
      // TAKEN-TOOLBAR/NOTES-SEARCH-1 (Danny 03-08): minimal additive line only —
      // another lane is actively editing this file's contact-link picker
      // (SelectMenu/contactOptionLabel above); this just supplies the shared
      // NotesTab's new search placeholder, nothing else touched here.
      searchPlaceholder: t('notes.searchPlaceholder'),
    },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SubTabBar
        tabs={[
          { id: 'notes',           label: t('notes.notes') },
          // Danny 03-08: the customer's Taken moved from a top-level drawer tab into
          // Communicatie — tasks sit between the notes (todo-adjacent) and the timeline.
          { id: 'tasks',           label: t('drawer.tabs.tasks') },
          { id: 'timeline',        label: t('notes.timeline') },
          { id: 'vacancySettings', label: t('drawer.tabs.vacancySettings') },
        ]}
        active={subTab}
        onChange={setSubTab}
      />
      {/* CONTACT-NOTITIES-1: optional "link the next note to a contact" picker —
          only where it applies (the composer lives on this sub-tab) and only when
          there is anyone to link to. Positioned above the composer rather than
          inside it: the composer itself belongs to the shared NotesTab component,
          out of scope for this change (see the chip comment above). */}
      {active === 'notes' && contactOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{t('notes.linkContactLabel')}</span>
          <div style={{ width: 240 }}>
            <SelectMenu value={pendingContactId} onChange={setPendingContactId}
              options={[{ value: '', label: t('notes.linkContactNone') }, ...contactOptions]}
              placeholder={t('notes.linkContactNone')} />
          </div>
        </div>
      )}
      {/* `key` remounts the composer when the linked contact changes — its writable
          note-type list switches scope (see noteTypes above), and a stale type
          picked under the OTHER scope would otherwise 422 on save. */}
      {active === 'notes'    && <NotesTab key={pendingContactId || 'none'} {...notesProps} showTimeline={false} showConversations={false} />}
      {/* The customer's Taken surface — moved here from the top-level drawer tab
          (Danny 03-08); the shared tab brings its own search/status-filter/add toolbar. */}
      {active === 'tasks' && (
        <EntityTasksTab linkType="customer" id={customerId} labels={{
          newTask: t('tasks.newTask'),
          empty: t('tasks.empty'), loading: t('tasks.loading'), error: t('tasks.error'),
          openTask: t('tasks.openTask'), searchPlaceholder: t('tasks.searchPlaceholder'),
        }} />
      )}
      {active === 'timeline' && <NotesTab {...notesProps} showNotes={false} showConversations={false} />}
      {active === 'vacancySettings' && <VacancySettingsTab c={c} onSave={onSave} />}

    </div>
  )
}
