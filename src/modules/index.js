import webhook           from './webhook'
import http_request      from './http_request'
import candidate_filter  from './candidate_filter'
import candidates_fetch  from './candidates_fetch'
import shift_fetcher     from './shift_fetcher'
import shifts_fetch      from './shifts_fetch'
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

const MODULES = [
  webhook,
  http_request,
  candidates_fetch,
  candidate_filter,
  shift_fetcher,
  shifts_fetch,
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
]

export const MODULE_META = Object.fromEntries(
  MODULES.map(m => [m.type, { label: m.label, Icon: m.Icon, color: m.color, bg: m.bg, category: m.category ?? 'Overig' }])
)

export const MODULE_SCHEMAS = Object.fromEntries(
  MODULES.map(m => [m.type, m.schema])
)

export default MODULES
