import webhook           from './webhook'
import sm_candidates     from './sm_candidates'
import sm_customers      from './sm_customers'
import sm_shifts         from './sm_shifts'
import sm_schedules      from './sm_schedules'
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
import sleep             from './sleep'
import error_ignore      from './error_ignore'
import error_break       from './error_break'
import error_resume      from './error_resume'
import error_commit      from './error_commit'
import error_rollback    from './error_rollback'
import whatsapp_send     from './whatsapp_send'
import ai_agent          from './ai_agent'
import knowledge_search  from './knowledge_search'
import router            from './router'
import filter            from './filter'
import email_send        from './email_send'
import delay             from './delay'
import html_parser       from './html_parser'
import html_to_text      from './html_to_text'
import html_table_parser from './html_table_parser'
import text_parser       from './text_parser'
import advanced_parser   from './advanced_parser'
import gateway_mail_hook from './gateway_mail_hook'
import wait              from './wait'
import ai_match          from './ai_match'
import condition         from './condition'
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
const MODULES: ModuleDef[] = [
  webhook,
  sm_candidates,
  sm_customers,
  sm_shifts,
  sm_schedules,
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
  sleep,
  error_ignore,
  error_break,
  error_resume,
  error_commit,
  error_rollback,
  whatsapp_send,
  ai_agent,
  knowledge_search,
  router,
  filter,
  email_send,
  delay,
  html_parser,
  html_to_text,
  html_table_parser,
  text_parser,
  advanced_parser,
  gateway_mail_hook,
  wait,
  ai_match,
  condition,
]

export const MODULE_META = Object.fromEntries(
  MODULES.map(m => [m.type, { label: m.label, Icon: m.Icon, color: m.color, bg: m.bg, category: m.category ?? 'Overig' }])
)

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
