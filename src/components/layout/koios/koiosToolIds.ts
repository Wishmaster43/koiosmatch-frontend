/**
 * english-code-ignore: this file's LEFT-hand keys are the deliberate legacy
 * Dutch tool ids from koiosmatch-api's LegacyToolNames — a translation table,
 * not new Dutch code, so it is exempt from the english-code ratchet.
 *
 * koiosToolIds — KOIOS-EN-1 phase B (Danny 28-09, FILES-EN-1). The backend renamed
 * all Koios tool ids to English (LegacyToolNames keeps the old ids resolving
 * server-side); the FE mirrors that with its own alias map so a not-yet-updated
 * response (or a cached pending action stored under the old id) still resolves
 * to the right icon/label/follow-up. TODO: remove this whole file once ONIX
 * closes and the backend drops LegacyToolNames (both aliases retire together).
 */

// Old (Dutch) tool id -> new (English) tool id. start_interview/stop_interview
// were already English and need no entry.
export const LEGACY_TOOL_IDS: Record<string, string> = {
  archiveer_afdeling: 'archive_department',
  archiveer_contactpersoon: 'archive_contact',
  archiveer_kandidaat: 'archive_candidate',
  archiveer_klant: 'archive_customer',
  archiveer_locatie: 'archive_location',
  archiveer_vacature: 'archive_vacancy',
  beeindig_match: 'terminate_match',
  bulk_kandidaten: 'bulk_candidates',
  bulk_kansen: 'bulk_opportunities',
  bulk_klanten: 'bulk_customers',
  bulk_sollicitaties: 'bulk_applications',
  bulk_taken: 'bulk_tasks',
  bulk_vacatures: 'bulk_vacancies',
  geef_aandachtspunten: 'get_attention_points',
  genereer_vacature: 'generate_vacancy',
  herstel_afdeling: 'restore_department',
  herstel_contactpersoon: 'restore_contact',
  herstel_kandidaat: 'restore_candidate',
  herstel_klant: 'restore_customer',
  herstel_locatie: 'restore_location',
  herstel_vacature: 'restore_vacancy',
  hervat_interview: 'resume_interview',
  keur_match_goed: 'approve_match',
  maak_afdeling: 'create_department',
  maak_bellijst: 'create_call_list',
  maak_contactpersoon: 'create_contact',
  maak_kandidaat: 'create_candidate',
  maak_kans: 'create_opportunity',
  maak_klant: 'create_customer',
  maak_locatie: 'create_location',
  maak_match: 'create_match',
  maak_sollicitatie: 'create_application',
  maak_taak: 'create_task',
  maak_vacature: 'create_vacancy',
  plan_afspraak: 'schedule_appointment',
  scoor_sollicitatie: 'score_application',
  stuur_notificatie: 'send_notification',
  stuur_whatsapp: 'send_whatsapp',
  verdeel_bellijst: 'distribute_call_list',
  verleng_match: 'extend_match',
  voeg_kans_notitie_toe: 'add_opportunity_note',
  voeg_match_notitie_toe: 'add_match_note',
  voeg_notitie_toe: 'add_note',
  voeg_taak_notitie_toe: 'add_task_note',
  voeg_toe_aan_bellijst: 'add_to_call_list',
  voorstel_sollicitatie: 'propose_application',
  wijs_match_af: 'reject_match',
  wijs_sollicitatie_af: 'reject_application',
  wijzig_afdeling: 'update_department',
  wijzig_afspraak: 'update_appointment',
  wijzig_contactpersoon: 'update_contact',
  wijzig_kandidaat: 'update_candidate',
  wijzig_kandidaat_status: 'update_candidate_status',
  wijzig_kans: 'update_opportunity',
  wijzig_klant: 'update_customer',
  wijzig_locatie: 'update_location',
  wijzig_notitie: 'update_note',
  wijzig_sollicitatie: 'update_application',
  wijzig_taak: 'update_task',
  wijzig_vacature: 'update_vacancy',
  zet_workflow_aan_uit: 'toggle_workflow',
  zoek_afdelingen: 'search_departments',
  zoek_afspraken: 'search_appointments',
  zoek_alles: 'search_all',
  zoek_bellijsten: 'search_call_lists',
  zoek_contactpersonen: 'search_contacts',
  zoek_documenten: 'search_documents',
  zoek_kandidaten: 'search_candidates',
  zoek_kansen: 'search_opportunities',
  zoek_klanten: 'search_customers',
  zoek_locaties: 'search_locations',
  zoek_matches: 'search_matches',
  zoek_notities: 'search_notes',
  zoek_plaats: 'search_place',
  zoek_sollicitaties: 'search_applications',
  zoek_taken: 'search_tasks',
  zoek_vacatures: 'search_vacancies',
  zoek_workflows: 'search_workflows',
}

// Resolves any tool id (old or new) to its canonical English id.
export function canonicalToolId(id: string): string {
  return LEGACY_TOOL_IDS[id] ?? id
}

// Reads a dual-key result field (KOIOS-EN-1 phase B: every tool result carries
// BOTH the English and the Dutch key for one release) — English first, Dutch
// fallback, so a still-Dutch-only payload keeps working during the alias period.
export function pick<T = unknown>(obj: Record<string, unknown> | null | undefined, enKey: string, nlKey: string): T | undefined {
  if (!obj) return undefined
  if (obj[enKey] !== undefined) return obj[enKey] as T
  return obj[nlKey] as T
}
