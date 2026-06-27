/**
 * AI management types (agents · prompts · FAQ · knowledge · chat test). The
 * panels map loosely-typed API payloads; these declare the fields they read.
 */

// A prompt / FAQ / knowledge item (shared shape — all have id + name + body/content).
export interface AiItem { id?: string | number; name?: string; body?: string; content?: string; version?: number; created_at?: string; [k: string]: unknown }

// An AI agent configuration.
export interface AiAgent {
  id?: string | number
  name?: string
  model?: string
  custom_endpoint?: string
  custom_api_key?: string
  prompt_id?: string | number
  faq_ids?: Array<string | number>
  use_knowledge?: boolean
  max_history?: number
  _new?: boolean
  [k: string]: unknown
}

// One message in the inline chat-test transcript.
export interface ChatMessage { role: string; content: string; error?: boolean }
