import webhook           from './webhook'
import candidate_filter  from './candidate_filter'
import candidates_fetch  from './candidates_fetch'
import shift_fetcher    from './shift_fetcher'
import whatsapp_send    from './whatsapp_send'
import ai_agent         from './ai_agent'
import knowledge_search from './knowledge_search'
import router           from './router'
import filter           from './filter'
import email_send       from './email_send'
import delay            from './delay'

const MODULES = [
  webhook,
  candidates_fetch,
  candidate_filter,
  shift_fetcher,
  whatsapp_send,
  ai_agent,
  knowledge_search,
  router,
  filter,
  email_send,
  delay,
]

export const MODULE_META = Object.fromEntries(
  MODULES.map(m => [m.type, { label: m.label, Icon: m.Icon, color: m.color, bg: m.bg }])
)

export const MODULE_SCHEMAS = Object.fromEntries(
  MODULES.map(m => [m.type, m.schema])
)

export default MODULES
