// Pure label/type helpers for NoteLinkPicker's search-list rows. Kept in a
// non-component module so unit tests exercise the pure logic without eagerly
// loading React/i18n/api through the component (BARREL-DATETIME-LES) and so
// the file carries no react-refresh export-shape constraint.
import type { Id } from '@/types/common'
import { contactOptionLabel, type ContactLike } from '@/lib/contactLabel'
import type { NoteLinkPrincipalType } from './noteLinksApi'

// The shape a search-list row may carry, across the five principal endpoints.
// `function` only exists on /contacts rows (the contact's job title at the customer).
export interface PickerRow extends ContactLike { id?: Id; first_name?: string; last_name?: string; customer_name?: string; [k: string]: unknown }

// Person display name, falling back to the id when no name field is present.
export const personName = (r: PickerRow): string => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || `#${r.id}`

// Contact rows show name plus job function via the shared "Name — Function"
// picker label (lib/contactLabel), the same builder every other contact
// picker in the app uses (§11, no re-invented copy).
export const contactLabel = (r: PickerRow): string => contactOptionLabel(r)

// principal type → where to search it + how to label one row. `location`
// (CustomerLocation) reads /customer-locations, same endpoint+disambiguation
// taskLinkTypes.ts already uses for its own `customer_location` token. Lifted
// out of the component (was a component-local const) so the wiring itself —
// which endpoint/label a token maps to — has a seam test that does not need
// to mock the API (mirrors taskLinkTypes.test.ts's TASK_LINK_ENDPOINTS seam).
export const PRINCIPAL_ENDPOINTS: Record<NoteLinkPrincipalType, { url: string; label: (r: PickerRow) => string }> = {
  candidate: { url: '/candidates', label: personName },
  customer: { url: '/customers', label: r => r.name || `#${r.id}` },
  location: { url: '/customer-locations', label: r => (r.customer_name ? `${r.name || `#${r.id}`} (${r.customer_name})` : (r.name || `#${r.id}`)) },
  department: { url: '/departments', label: r => r.name || `#${r.id}` },
  contact: { url: '/contacts', label: contactLabel },
}
export const PRINCIPAL_TYPES = Object.keys(PRINCIPAL_ENDPOINTS) as NoteLinkPrincipalType[]
