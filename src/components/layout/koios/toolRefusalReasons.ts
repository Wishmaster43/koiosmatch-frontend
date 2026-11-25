// Refusal slugs the Koios pending-action card translates via koios.pendingAction.reasons.<slug>:
// the BE's ToolRefusalReason enum arrives GENERATED from its JSON export (KOIOS-TOOL-RESULT-KEYS-3,
// `npm run gen:refusal-reasons`), plus the slugs other backend sources emit verbatim, listed by hand.
import { BE_TOOL_REFUSAL_REASON_SLUGS } from './toolRefusalReasons.generated'

// Slugs that are NOT enum constants: emitted verbatim by other BE sources (each named below).
export const EXTRA_SOURCE_REFUSAL_SLUGS: readonly string[] = [
  // Interview engine start reason
  'no_email_consent',
  // Interview engine start reason
  'no_mobile_or_consent',
  // Connection check
  'no_active_connection',
  // ProposalMailer ERROR_* constant
  'send_failed',
]

// The full list the translation guard and the card know: the generated enum plus the extras.
export const TOOL_REFUSAL_REASON_SLUGS: readonly string[] = [...BE_TOOL_REFUSAL_REASON_SLUGS, ...EXTRA_SOURCE_REFUSAL_SLUGS]
