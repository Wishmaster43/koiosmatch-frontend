/**
 * KoiosSuggestionBadge — the ONE marker for a value the system proposed
 * (KOIOS-VOORSTEL-1, Danny 13-08: "het moet voor de eindgebruiker duidelijk zijn
 * dat Koios dit voorstelt — ons eigen icon"). Koios is the face of EVERY system
 * suggestion, also plainly programmed heuristics — never a second marker.
 * Renders the shared KoiosAiMark + a translated "Koios AI" proposal line; the
 * caller shows it only while the suggestion still holds (cleared/repicked = gone).
 */
import { useTranslation } from 'react-i18next'
import KoiosAiMark from './KoiosAiMark'

export default function KoiosSuggestionBadge() {
  const { t } = useTranslation('common')
  return (
    <span data-testid="koios-suggestion" style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, color: 'var(--color-primary-text)', marginTop: 5 }}>
      <KoiosAiMark size={14} tone="soft" />
      {t('koiosSuggested')}
    </span>
  )
}
