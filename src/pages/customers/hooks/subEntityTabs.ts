import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import type { SubTab } from '@/components/drawer/SubTabBar'
import type { CustomFieldDef } from '@/lib/useCustomFields'

// A conditional trailing tab (timeline/Koppelingen): callers decide the condition
// (a customerId != null check, the showKoppelingen flag, or an always-true).
interface ConditionalTab {
  show: boolean
  label: ReactNode
}

/**
 * buildSubEntityTabs — the shared SubTabBar tab-list shape for a customer
 * sub-entity detail (Department/Location/Contact): a `first` tab (Gegevens/Adres
 * & gegevens), the caller's own SCOPED-LIST-TAB-1 tabs in the middle (contacts/
 * vacancies/applications/notes/…, each carrying its own i18n key and history
 * comment at the call site — this builder does not know their meaning), then
 * TIJDLIJN-SUBDRILL-1's timeline tab second-to-last and the EXTRACT-1/DD-FE-6
 * Koppelingen tab last — both hidden unless their own `show` condition holds
 * (DD-FE-6: "no empty tabs" — Koppelingen is empty without an enabled connector app).
 * The timeline tab is gated the same way by the caller (`customerId != null`): its panel
 * needs the customer id for the nested /activity route (DD-FE-6, no empty tabs).
 */
export function buildSubEntityTabs({ first, scoped, timeline, links }: {
  first: SubTab
  scoped: SubTab[]
  timeline: ConditionalTab
  links: ConditionalTab
}): SubTab[] {
  return [
    first,
    ...scoped,
    ...(timeline.show ? [{ id: 'timeline', label: timeline.label }] : []),
    ...(links.show ? [{ id: 'links', label: links.label }] : []),
  ]
}

/**
 * scopedSubEntityTabs — the ten scoped tab entries (Contacts through Extra)
 * shared verbatim by DepartmentDetail and LocationDetail's `scoped` list
 * (DRY round 11, CUSTTABS2). LocationDetail prepends its own leading
 * 'departments' entry (a department has none) before spreading this; the
 * `timeline`/`links` lines stay at each detail (the location's `show: true`
 * for Koppelingen, its own EXTRACT-1 reason, is a real difference from the
 * department's `showKoppelingen`-gated one — see buildSubEntityTabs' doc).
 * SCOPED-LIST-TAB-1: read-only lists scoped to this department/location (§3A
 * shared tab). SOLLICITATIES-SCOPE-1: reuses the applications page's own
 * title key — already carries full five-locale parity, verified in c0e0d900.
 * NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: reuse the existing top-level
 * drawer.tabs.notes/documents keys (already five-locale complete) — right
 * after Sollicitaties, per Danny's ask. K-288: linked-notes feed's own
 * sub-tab, right after Notities. TAKEN-OP-AFDELING-1/TAKEN-OP-LOCATIE-1:
 * TaskLinkResolver already knows both 'department' and 'customer_location' →
 * task_links. The Extra tab only shows when the tenant has defined custom
 * fields for this scope (§3A(f)).
 */
export function scopedSubEntityTabs(t: TFunction, customFieldDefs: CustomFieldDef[]): SubTab[] {
  return [
    { id: 'contacts', label: t('drawer.tabs.contacts') },
    { id: 'vacancies', label: t('drawer.tabs.vacancies') },
    { id: 'applications', label: t('applications:title') },
    { id: 'notes', label: t('drawer.tabs.notes') },
    { id: 'linkedNotes', label: t('notes.linkedNotes') },
    { id: 'documents', label: t('drawer.tabs.documents') },
    { id: 'matches', label: t('drawer.tabs.matches') },
    { id: 'opportunities', label: t('drawer.tabs.opportunities') },
    { id: 'tasks', label: t('drawer.tabs.tasks') },
    ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
  ]
}
