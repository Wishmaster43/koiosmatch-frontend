/**
 * AI management types (agents · prompts · FAQ · knowledge · chat test). The
 * panels map loosely-typed API payloads; these declare the fields they read.
 */

// A prompt / FAQ / knowledge item (shared shape — all have id + name + body/content).
export interface AiItem { id?: string | number; name?: string; body?: string; content?: string; version?: number; created_at?: string; [k: string]: unknown }

// The recruiter/manager user an agent mirrors (AI-AGENTS-2: one agent per user).
export interface AiAgentUser { id: string | number; name?: string | null }

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
}

// An AI agent configuration. Deliberately has no `model` field (MODEL-1: the
// company-wide model from Settings is used everywhere — never per-agent).
export interface AiAgent {
  id?: string | number
  name?: string
  custom_endpoint?: string
  custom_api_key?: string
  prompt_id?: string | number
  faq_ids?: Array<string | number>
  use_knowledge?: boolean
  max_history?: number
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
