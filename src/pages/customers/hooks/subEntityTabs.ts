import type { ReactNode } from 'react'
import type { SubTab } from '@/components/drawer/SubTabBar'

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
