/**
 * koiosSuggestionMeta — pure lookup tables for one suggestion row
 * (KOIOS-SUGGEST-COMPACT-1, Danny 24-09: "short and punchy, one icon+colour
 * per task type, standards make translation easier"). KIND_META gives every
 * suggestion kind its own icon + semantic-token colour (§4: colour carries
 * meaning); TOOL_ICONS gives every known ACTION its own icon (CMBE addendum
 * 28-09: keyed by the action's `key`, falling back to the registry `tool`
 * name, then a generic "run" glyph for anything neither table lists).
 */
import { Clock, UserX, Target, Briefcase, Sparkles, Check, CalendarClock, ListPlus, Search, MessageCircle, Play, MessageSquareDashed } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { KoiosAssistantKind, KoiosAssistantSuggestion } from './useKoiosAssistant'
import { canonicalToolId } from './koiosToolIds'

// Stable row identity (Opus golf-2 verify): the pending-action id when present,
// else kind+title — never the array index, which glued one action's terminal
// state onto a DIFFERENT action after a refetch reshuffled the list.
export function suggestionKey(s: KoiosAssistantSuggestion): string {
  const ref = s.refs.find(r => r.type === 'pending_action')
  return ref ? `pa:${ref.id}` : `${s.kind}:${s.title}`
}

// Icon + semantic-token colour per suggestion kind (§4: colour carries meaning, never
// decoration). KOIOS-SUGGEST-COMPACT-2 (Danny 28-09: "email en kandidaat icons lijken
// zelfde kleur"): every kind carries a colour distinct from its siblings AND from the
// chip's own ink (`--color-primary-text`) — candidate_no_contact moves to the danger
// token (a person going cold reads as a real warning), opportunity takes primary and
// vacancy takes info; only pending_action shares primary, as the assistant's own colour.
export const KIND_META: Record<KoiosAssistantKind, { Icon: LucideIcon; color: string }> = {
  pending_action:            { Icon: Sparkles,  color: 'var(--color-primary)' },
  task_overdue:              { Icon: Clock,      color: 'var(--color-warning-text)' },
  candidate_no_contact:      { Icon: UserX,      color: 'var(--color-danger-text)' },
  opportunity_closing_soon:  { Icon: Target,     color: 'var(--color-primary)' },
  vacancy_zero_applications: { Icon: Briefcase,  color: 'var(--color-info)' },
  // INTERVIEW-VISIBILITY-1: an AI interview waiting on the applicant (BE 04fe3a2a) — warning, like an overdue task.
  interview_stalled:         { Icon: MessageSquareDashed, color: 'var(--color-warning-text)' },
}

// One icon per known ACTION key (the action's own verb, Danny: "elke type taak
// moet zijn eigen icon hebben").
export const TOOL_ICONS: Record<string, LucideIcon> = {
  complete_task: Check,
  reschedule_task: CalendarClock,
  send_whatsapp: MessageCircle,
  create_task: ListPlus,
  search_candidates: Search,
}

// Fallback by the registry TOOL name (KOIOS-EN-1 phase B: keyed by the English
// tool id, resolved via canonicalToolId so an old Dutch id still lands), for
// an action whose `key` isn't (yet) one of the five above — e.g. an older
// payload that only sends `tool`.
const TOOL_NAME_ICONS: Record<string, LucideIcon> = {
  update_task: CalendarClock,
  create_task: ListPlus,
  send_whatsapp: MessageCircle,
  search_candidates: Search,
}

// The action's icon: its own `key` glyph, else the `tool` glyph, else the generic fallback.
export function toolIcon(action: { key?: string | null; tool?: string } | undefined): LucideIcon {
  if (!action) return Play
  const tool = action.tool ? canonicalToolId(action.tool) : undefined
  return (action.key && TOOL_ICONS[action.key]) || (tool && TOOL_NAME_ICONS[tool]) || Play
}

// Where an executed tool leaves the user (KOIOS-ROW-2, Danny: "you would expect the
// right vacancy's drilldown to open with the candidate-search tab shown right
// away"): the row's ref of that type opens on that drawer tab. The confirm response
// may also carry `data.navigate` {type,id,tab}; that wins when present.
export const TOOL_FOLLOW_UP: Record<string, { refType: string; tab: string }> = {
  search_candidates: { refType: 'vacancy', tab: 'candidateSearch' },
}

// The short-reason i18n key when `params` is present (an ICU-plural key), and the
// even shorter fallback when the server hasn't shipped `params` yet — never the
// server's own Dutch prose (`body`), which stays only as the row's tooltip.
export const reasonKey = (kind: KoiosAssistantKind): string => `koios.assistant.reason.${kind}`
export const reasonShortKey = (kind: KoiosAssistantKind): string => `koios.assistant.reasonShort.${kind}`
