/**
 * NoticePeriodHint — links "Opzegtermijn (weken)" to "Inzetbaar vanaf".
 *
 * Danny 2026-08-08 (punt 9): a notice period and an availability date are one
 * thing — someone with X weeks' notice can only be deployed X weeks from now.
 * The two fields therefore live side by side in the Beschikbaarheid card, and
 * this hint makes the relation visible: with a notice period on file but NO
 * availability date yet, it shows the DERIVED date (today + X weeks) and offers
 * to take it over.
 *
 * It is a SUGGESTION, never an automatism (§3, no fake affordances and no silent
 * maths over the recruiter's own input): the hint disappears the moment a date is
 * recorded, it never overwrites an existing one, and taking it over is an explicit
 * button press that persists exactly one field (`preferences.available_from`).
 */
import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import CalloutBox from '@/components/ui/CalloutBox'
import { deriveAvailableFrom, toNoticeWeeks } from './noticePeriod'

interface NoticePeriodHintProps {
  // Stored notice period in weeks (number or string, possibly empty/null).
  weeks: unknown
  // Stored availability date — any truthy value silences the hint entirely.
  availableFrom: unknown
  // Persists the derived date. Omitted (or canApply=false) renders the hint read-only.
  onApply?: (isoDate: string) => void
  // False while the card is being edited: a background PATCH would be overwritten
  // by the open draft on save, so the take-over is offered in read mode only.
  canApply?: boolean
  // Injectable clock for deterministic tests.
  now?: Date
}

// Shows the derived available-from date (today + notice weeks) as a one-click suggestion; disappears once a real date is on file, and never applies itself (see file header).
export default function NoticePeriodHint({ weeks, availableFrom, onApply, canApply = true, now }: NoticePeriodHintProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()

  // Only speak up when there is something to say: a notice period on file and no
  // availability date to argue with.
  const derived = deriveAvailableFrom(toNoticeWeeks(weeks), now)
  const hasDate = availableFrom !== null && availableFrom !== undefined && String(availableFrom).trim() !== ''
  if (!derived || hasDate) return null

  // The shared house callout carries the info tint (§4 tokens, no ad-hoc hex): the
  // ACCENT token colours the icon only, the sentence stays on --text so the hint
  // clears 4.5:1 in both themes — --color-info as body text would not.
  return (
    <CalloutBox variant="info">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <CalendarClock size={14} style={{ flexShrink: 0, color: 'var(--color-info)' }} aria-hidden="true" />
        {/* Dates read as DD-MM-YYYY through the house formatter (§3B). */}
        <span style={{ flex: 1, minWidth: 160, fontSize: 12 }}>
          {t('preferences.noticePeriodDerivedHint', { count: toNoticeWeeks(weeks), date: formatDate(derived) })}
        </span>
        {/* A real bordered button, never coloured text posing as a link (Danny 08-08). */}
        {canApply && onApply && (
          <button type="button" onClick={() => onApply(derived)}
            style={{ flexShrink: 0, padding: '5px 11px', fontSize: 12, fontWeight: 600, borderRadius: 7, cursor: 'pointer',
              color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {t('preferences.noticePeriodApply')}
          </button>
        )}
      </div>
    </CalloutBox>
  )
}
