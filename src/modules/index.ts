/**
 * modules/index — the module registry barrel. Every workflow building block
 * (§0.11: workflow tokens, not coded jobs) is imported once here and folded
 * into the derived lookup maps below (label/icon, config schema, required
 * app/module, Make.com identifier mapping). The ONE source the canvas editor
 * and the module picker both read — never a second hand-maintained map.
 */
import task_create        from './task_create'
import appointment_create from './appointment_create'
import calllist_add       from './calllist_add'
import webhook_send       from './webhook_send'
import candidate_archive  from './candidate_archive'
import leads_recount      from './leads_recount'
import experience_add     from './experience_add'
import sm_employee_create from './sm_employee_create'
import workflow_call      from './workflow_call'
import webhook           from './webhook'
import whatsapp_inbound  from './whatsapp_inbound'
import application_lookup from './application_lookup'
import sm_candidates     from './sm_candidates'
import sm_customers      from './sm_customers'
import sm_shifts         from './sm_shifts'
import sm_schedules      from './sm_schedules'
import shift_fetch       from './shift_fetch'
import shift_score       from './shift_score'
import candidate_filter  from './candidate_filter'
import status_set        from './status_set'
import scenario          from './scenario'
import sm_employees      from './sm_employees'
import sm_employee_update from './sm_employee_update'
import message_lookup    from './message_lookup'
import hf_candidates     from './hf_candidates'
import hf_customers      from './hf_customers'
import hf_shifts         from './hf_shifts'
import intus_candidates  from './intus_candidates'
import intus_shifts      from './intus_shifts'
import candidates        from './candidates'
import applications      from './applications'
import vacancies         from './vacancies'
import matches           from './matches'
import opportunities     from './opportunities'
import tasks             from './tasks'
import customers         from './customers'
import customer_locations from './customer_locations'
import customer_departments from './customer_departments'
import customer_contacts from './customer_contacts'
import outreach_campaigns from './outreach_campaigns'
import planning          from './planning'
import applicant_event   from './applicant_event'
import applicant_message from './applicant_message'
import shifts_input      from './shifts_input'
import iterator          from './iterator'
import aggregator        from './aggregator'
import text_aggregator   from './text_aggregator'
import numeric_aggregator from './numeric_aggregator'
import table_aggregator  from './table_aggregator'
import feeder            from './feeder'
import repeater          from './repeater'
import set_variable      from './set_variable'
import set_variables     from './set_variables'
import get_variable      from './get_variable'
import get_variables     from './get_variables'
import error_ignore      from './error_ignore'
import error_break       from './error_break'
import error_resume      from './error_resume'
import error_commit      from './error_commit'
import error_rollback    from './error_rollback'
import whatsapp_send     from './whatsapp_send'
import ai_agent          from './ai_agent'
import interview_start   from './interview_start'
import knowledge_search  from './knowledge_search'
import router            from './router'
import filter            from './filter'
import email_send        from './email_send'
import notification_send from './notification_send'
import html_parser       from './html_parser'
import html_to_text      from './html_to_text'
import html_table_parser from './html_table_parser'
import text_parser       from './text_parser'
import advanced_parser   from './advanced_parser'
import gateway_mail_hook from './gateway_mail_hook'
import wait              from './wait'
import ai_match          from './ai_match'
import condition         from './condition'
import facebook_send     from './facebook_send'
import candidates_fetch  from './candidates_fetch'
import backoffice_sync   from './backoffice_sync'
import pdok_geocode      from './pdok_geocode'
import type { ModuleDef } from './types'

/**
 * Module registry — the single source of truth for every workflow building block.
 *
 * Each imported module is a definition object ({ type, label, Icon, schema, app,
 * makeType, ... }). The derived maps below are what the rest of the app consumes:
 *   MODULE_META    — display info (label/icon/colors) keyed by type
 *   MODULE_SCHEMAS — the form fields for each module's config panel
 *   MODULE_APP_MAP — type → required add-on app(s) for visibility gating
 *   MAKE_MODULE_MAP — Make.com identifier → internal type (for import/mapping)
 * To add a module: import it and append it here; the maps update automatically.
 */

// ENGINE-INTERNAL TYPES (WF-MODULE-RECONCILE-FE-1) — module_type strings the
// backend engine runs but that must NEVER get an FE registry card, because the
// engine synthesises them itself rather than a builder ever picking one. 'trigger'
// (App\Workflow\WorkflowEngine::$moduleMap) is the internal step every workflow
// implicitly starts with; the workflow's OWN trigger (webhook/scheduled/event/…)
// is authored via the trigger/trigger_config fields (WorkflowEditorHeader +
// ScheduleModal), never via a canvas node of this type. Listed here so a future
// registry reconcile (grepping the engine's moduleMap for FE gaps) recognises the
// omission as deliberate instead of re-flagging it as a missing module.
export const ENGINE_INTERNAL_TYPES = ['trigger'] as const

const MODULES: ModuleDef[] = [
  task_create,
  appointment_create,
  calllist_add,
  webhook_send,
  candidate_archive,
  leads_recount,
  experience_add,
  sm_employee_create,
  workflow_call,
  webhook,
  sm_candidates,
  sm_customers,
  sm_shifts,
  sm_schedules,
  shift_fetch,
  shift_score,
  candidate_filter,
  status_set,
  scenario,
  sm_employees,
  sm_employee_update,
  message_lookup,
  hf_candidates,
  hf_customers,
  hf_shifts,
  intus_candidates,
  intus_shifts,
  candidates,
  applications,
  vacancies,
  matches,
  opportunities,
  tasks,
  customers,
  planning,
  applicant_event,
  applicant_message,
  shifts_input,
  iterator,
  aggregator,
  text_aggregator,
  numeric_aggregator,
  table_aggregator,
  feeder,
  repeater,
  set_variable,
  set_variables,
  get_variable,
  get_variables,
  error_ignore,
  error_break,
  error_resume,
  error_commit,
  error_rollback,
  whatsapp_send,
  ai_agent,
  interview_start,
  knowledge_search,
  router,
  filter,
  email_send,
  notification_send,
  html_parser,
  html_to_text,
  html_table_parser,
  text_parser,
  advanced_parser,
  gateway_mail_hook,
  wait,
  ai_match,
  condition,
  facebook_send,
  pdok_geocode,
  candidates_fetch,
  backoffice_sync,
  customer_locations,
  customer_departments,
  customer_contacts,
  outreach_campaigns,
  whatsapp_inbound,
  application_lookup,
]

export const MODULE_META = Object.fromEntries(
  MODULES.map(m => [m.type, { label: m.label, Icon: m.Icon, color: m.color, bg: m.bg, category: m.category ?? 'Overig', hidden: m.hidden }])
)

// VERTREKMODULE-1: the types a workflow may START with — Koios entity nodes and
// the inbound webhook. Everything else as first step is a finding (CLAUDE.md §10.5).
// CMBE-antwoord 31-08: naast de isStart-gemarkeerde modules (entiteitsnodes +
// webhook) zijn ook geldig: de SM-vertrekken, twee legacy-maar-geseede
// ai_planner-vertrekken en het komende whatsapp_inbound-vertrek (kanaalkeuze
// waba/waba_coex/wa_web). 'trigger' (oude generieke vertrek) blijft bewust
// ONgeldig — de herseed faseert hem uit, de waarschuwing is daar terecht.
export const START_MODULE_TYPES = new Set([
  ...MODULES.filter(m => m.isStart).map(m => m.type),
  'sm_employees', 'sm_schedules',
  // CMFE-besluit 31-08 (CMBE-vraag): de SM-sync-starts zijn dezelfde familie —
  // de SM-spiegel IS het subject van die workflows (4 geseede templates).
  'sm_candidates', 'sm_customers', 'sm_shifts',
  'candidate_filter', 'candidates_fetch',
  'whatsapp_inbound',
])

export const MODULE_SCHEMAS = Object.fromEntries(
  MODULES.map(m => [m.type, m.schema])
)

// Maps module type → required app id(s) (string or array). No entry = always visible.
export const MODULE_APP_MAP = Object.fromEntries(
  MODULES.filter(m => m.app).map(m => [m.type, m.app])
)

// Maps module type → required billing module key (e.g. 'plan'). No entry = no module gate.
// Separate axis from MODULE_APP_MAP: apps = connectors (AppsContext), modules = package add-ons.
export const MODULE_REQUIRED_MODULE = Object.fromEntries(
  MODULES.filter(m => m.module).map(m => [m.type, m.module as string])
)

// Maps Make.com module identifiers → internal type.
export const MAKE_MODULE_MAP = Object.fromEntries(
  MODULES.filter(m => m.makeType).map(m => [String(m.makeType), m.type])
)

export default MODULES
