/**
 * koiosMentionCategories — the "@" category list (order fixed by Danny 13/7):
 * Kandidaten · Leads · Sollicitaties · Vacatures · Matches · Kansen · Taken ·
 * Bellijsten · Klanten · Locaties · Afdelingen · Contactpersonen · AI & Workflows
 * · WhatsApp. Planning is REMOVED (it was in the old hardcoded MENTIONS list).
 *
 * `labelKey` reuses the sidebar's own nav.* key wherever one exists (Sidebar.jsx
 * NAV_ITEMS) so the mention menu never drifts from the nav labels; entries with
 * no nav equivalent (Leads, Locaties, Afdelingen, Contactpersonen — all either a
 * new axis or customer-scoped sub-entities) get a dedicated koios.mention.* key,
 * translated in all 5 shipped locales (§5).
 *
 * `countKey` names the field of KoiosMentionCounts that feeds this entry's desc
 * line; omitted where there is no cheap tenant-wide total to show (customer-
 * scoped sub-entities, or a page that isn't an entity list).
 */
export interface MentionCategoryConfig {
  id: string
  labelKey: string
  countKey?: string
}

export const MENTION_CATEGORIES: MentionCategoryConfig[] = [
  { id: 'candidates', labelKey: 'nav.candidates', countKey: 'candidates' },
  { id: 'leads', labelKey: 'koios.mention.leads', countKey: 'leads' },
  { id: 'applications', labelKey: 'nav.applications', countKey: 'applications' },
  { id: 'vacancies', labelKey: 'nav.vacancies', countKey: 'vacancies' },
  { id: 'matches', labelKey: 'nav.matches', countKey: 'matches' },
  { id: 'opportunities', labelKey: 'nav.opportunities', countKey: 'opportunities' },
  { id: 'tasks', labelKey: 'nav.tasks', countKey: 'tasks' },
  { id: 'outreach', labelKey: 'nav.outreach', countKey: 'outreach' },
  { id: 'customers', labelKey: 'nav.customers', countKey: 'customers' },
  { id: 'locations', labelKey: 'koios.mention.locations' },
  { id: 'departments', labelKey: 'koios.mention.departments' },
  { id: 'contacts', labelKey: 'koios.mention.contacts' },
  { id: 'aiagents', labelKey: 'nav.aiagents' },
  { id: 'whatsapp', labelKey: 'nav.whatsapp' },
]
