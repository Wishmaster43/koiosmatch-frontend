/**
 * AI management types (agents · prompts · FAQ · knowledge · chat test). The
 * panels map loosely-typed API payloads; these declare the fields they read.
 */

// A prompt / FAQ / knowledge item (shared shape — all have id + name + body).
export interface AiItem { id?: string | number; name?: string; body?: string; version?: number; created_at?: string; [k: string]: unknown }

// A knowledge-item lookup row (GET /ai/knowledge/lookup, KNOWLEDGE-SCOPE-1) — the
// pickable option set for an agent's own knowledge_ids coupling.
export interface AiKnowledgeLookupItem { value: string; label: string }

// The recruiter/manager user an agent mirrors (AI-AGENTS-2: one agent per user).
interface AiAgentUser { id: string | number; name?: string | null }

// The tenant-configurable interview design an agent carries (AI-AGENTS-3). `statuses`
// is the ordered lifecycle key list; `output_fields` maps a dossier field name to
// its (currently always string) type.
export interface InterviewFlow {
  id?: string | number
  name?: string
  active?: boolean
  intro_template?: string | null
  system_prompt?: string
  statuses?: string[]
  output_fields?: Record<string, unknown>
  // Measured against $fillable + rules() (FLOW-EDITOR-1, r2): the agent link
  // and channel are real columns; _new mirrors AiAgent's create-marker idiom.
  ai_agent_id?: string | null
  channel?: string
  _new?: boolean
}

// An AI agent configuration. Deliberately has no `model` field (MODEL-1: the
// company-wide model from Settings is used everywhere — never per-agent).
export interface AiAgent {
  // PUNT-2 agent-kaart (BE 0a8521df): inbound-verwerkingsstempels, read-only display.
  last_inbound_at?: string | null
  inbound_handled_count?: number | null
  last_inbound_error_at?: string | null
  last_inbound_error_code?: string | null
  id?: string | number
  name?: string
  custom_endpoint?: string
  // Write-only (CMBE 2026-07-15): the real key never round-trips back in a GET —
  // only this flag says one is stored. `custom_api_key` is a REQUEST-only field,
  // sent solely when the user types a new value (never prefilled from `agent`).
  has_custom_api_key?: boolean
  custom_api_key?: string
  prompt_id?: string | number
  faq_ids?: Array<string | number>
  // KNOWLEDGE-SCOPE-1 (K-276): the per-agent knowledge coupling (ai_agent_knowledge
  // pivot) — an empty array means no knowledge text on chat/test/interview, never
  // "falls back to everything". Returned via $appends even when never sent.
  knowledge_ids?: string[]
  use_knowledge?: boolean
  // Derived field: true when ≥1 knowledge item is coupled to this agent.
  has_knowledge?: boolean
  max_history?: number
  // The WhatsApp-approved template that opens the conversation with the candidate
  // (WA_INTRO_TEMPLATE-1) — always a real synced template name, never free text.
  wa_intro_template?: string | null
  // AI-AGENTS-2/3: the linked recruiter/manager user, this agent's interview
  // flow (read-only here — see InterviewFlowSection) and its own webhook URL.
  user?: AiAgentUser | null
  interview_flow?: InterviewFlow | null
  interview_flow_id?: string | number | null
  webhook_url?: string | null
  _new?: boolean
  [k: string]: unknown
}

// One message in the inline chat-test transcript.
export interface ChatMessage { role: string; content: string; error?: boolean }
