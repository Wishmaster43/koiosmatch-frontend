/**
 * KoiosSuggestionBadge — the ONE marker for a value the system proposed
 * (KOIOS-VOORSTEL-1, Danny 13-08: "het moet voor de eindgebruiker duidelijk zijn
 * dat Koios dit voorstelt — ons eigen icon" — "it must be clear to the end user
 * that Koios is proposing this — our own icon"). Koios is the face of EVERY system
 * suggestion, also plainly programmed heuristics — never a second marker.
 * Renders the shared KoiosAiMark + a translated "Koios AI" proposal line; the
 * caller shows it only while the suggestion still holds (cleared/repicked = gone).
 * `labelKey` lets a caller point at a more specific i18n key describing WHAT was
 * derived (e.g. the vacancy owner's AI agent) while keeping the same mark/shape —
 * defaults to the original candidate-history copy so existing callers are unchanged.
 */
import { useTranslation } from 'react-i18next'
import KoiosAiMark from './KoiosAiMark'

interface Props { labelKey?: string }

// The one "Koios proposed this" marker (see file docblock above) — the mark stays
// the same shape regardless of which specific i18n copy a caller passes.
export default function KoiosSuggestionBadge({ labelKey = 'koiosSuggested' }: Props) {
  const { t } = useTranslation('common')
  return (
    <span data-testid="koios-suggestion" style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, color: 'var(--color-primary-text)', marginTop: 5 }}>
      <KoiosAiMark size={14} tone="soft" />
      {t(labelKey)}
    </span>
  )
}
