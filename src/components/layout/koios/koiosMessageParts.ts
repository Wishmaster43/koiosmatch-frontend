/**
 * koiosMessageParts — the non-component pieces of the chat bubble: the shared
 * assistant-avatar GRADIENT and the resolveMessage text/notice mapper. Lives
 * apart from KoiosMessage.tsx so that file exports only its component
 * (react-refresh/only-export-components) and so KoiosHeader/TypingIndicator
 * import ONE canonical gradient instead of keeping copies.
 */
import type { KoiosChatMessage, TFn } from '@/types/koios'

// Gradient used for the assistant avatar + user bubble (shared with TypingIndicator).
export const GRADIENT = 'linear-gradient(135deg,var(--color-primary),var(--color-violet))'

// What the welcome bubble knows about the reader (Danny 09-09: a personal, short
// greeting — "Hi Kelly, what can I do for you" plus "there are N attention points
// for you" — no feature list).
export interface KoiosGreeting { name?: string | null; attentionCount?: number }

// Resolve a message to its display text + whether it's a calm system notice
// (notices carry no steps/usage). Keeps the JSX below readable.
export function resolveMessage(msg: KoiosChatMessage, t: TFn, greeting?: KoiosGreeting) {
  if (msg.kind === 'welcome') {
    const name = greeting?.name?.trim()
    const hello = name ? t('koios.welcome', { name }) : t('koios.welcomeAnonymous')
    const count = greeting?.attentionCount ?? 0
    return { text: count > 0 ? `${hello}\n\n${t('koios.welcomeAttention', { count })}` : hello, notice: false }
  }
  if (msg.kind === 'error')     return { text: t('koios.errorReply'),    notice: true }
  if (msg.kind === 'forbidden') return { text: t('koios.forbidden'),     notice: true }
  // A known backend error code (credit exhausted, temporary outage) gets its own
  // translated notice instead of the generic "couldn't reach Koios" line.
  if (msg.kind === 'knownError') return { text: t(msg.errorKey ?? 'errorReply'), notice: true }
  if (msg.role === 'user')      return { text: msg.content,              notice: false }
  if (msg.stopReason === 'not_configured')
    return { text: msg.answer || t('koios.notConfigured'),               notice: true }
  // KOIOS-CHAT-SIGNALS-FE-1: a budget-exhausted stop reads the reason the backend
  // stamped on `budget.reason` — daily caps reset tomorrow, the monthly cap next
  // month — instead of always showing the server's monthly-only sentence.
  if (msg.stopReason === 'budget_exceeded') {
    const isDaily = msg.budget?.reason === 'daily_user' || msg.budget?.reason === 'daily_tenant'
    return { text: t(isDaily ? 'koios.budgetExceededDaily' : 'koios.budgetExceededMonthly'), notice: true }
  }
  return { text: msg.answer, notice: false }
}

