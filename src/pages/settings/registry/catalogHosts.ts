// Settings registry — CATALOG_GROUP_HOSTS: where a generic catalogue section (windows/
// retention/messaging/email) is embedded, since the standalone catalogue nav screens
// were retired in favour of hosting each section under its owning entity's own screen.
// CATALOG-EMBED-1 (Danny 13-09, rows 21-24: "Whatsapp hoort bij Whatsapp · Inbox
// mail hoort bij email instellingen", "Hoort bij kandidaten en systemen", "Hoort
// bij email!", "Hoort onderdeel te zijn bij alle instellingen!!"): the four
// generic catalogue nav screens (windows/retention/messaging/email — SETTINGS-
// CATALOG-1) are RETIRED. Every catalogue group now renders under its own
// entity's screen via <CatalogSection section group /> (page mode) or embedded
// under an existing screen — see CATALOG_GROUP_HOSTS below for the full map.
// windows/opportunities gained its first generic rows with KPI-BUILDER-1 (BE 5e3c7a24,
// catalogue 0c40bd856b76: the two <key>_unit pickers) — hosted by opportunity_windows.
export const CATALOG_GROUP_HOSTS: Record<string, Record<string, string>> = {
  windows: {
    candidates: 'candidate/candidate_windows',
    contacts: 'contacts/contact_windows',
    customers: 'customers/customer_windows',
    vacancies: 'vacancies/vacancy_windows',
    applications: 'applications/application_windows',
    matches: 'matches/match_windows',
    opportunities: 'opportunities/opportunity_windows',
    tasks: 'tasks/task_windows',
    // Embedded at the bottom of the WhatsApp connection screen (Connection tab).
    conversations: 'whatsapp/whatsapp',
  },
  retention: {
    // Embedded at the bottom of the candidate retention screen.
    candidates: 'candidate/candidate_retention',
    system: 'administration/system',
  },
  messaging: {
    // Embedded at the bottom of the WhatsApp connection screen (Connection tab).
    whatsapp_limits: 'whatsapp/whatsapp',
    // Embedded inside the merged E-mail algemeen screen.
    inbox: 'communication/email_general',
  },
  email: {
    // Embedded inside the merged E-mail algemeen screen.
    mail: 'communication/email_general',
  },
}
