/**
 * LinkedExperience — the two read-only views of the reference ↔ work-experience
 * link (REF-ERVARING-1, Danny 08-08 punt 4). The link's rules, types and label
 * formatting live in referenceExperienceLink.ts (pure helpers + hooks); this file
 * holds only the presentation, so neither file mixes the two.
 */
import { useTranslation } from 'react-i18next'
import { Briefcase, Info } from 'lucide-react'
import { useExperienceLabel, type LinkableExperience } from './referenceExperienceLink'

/** Read-only line for a reference's linked work experience: "werkgever · functie ·
 *  periode". Same muted tone as the reference-letter link right above it — linking
 *  and unlinking live in the row's own edit form (one pencil per row), so this line
 *  deliberately carries no second edit affordance. */
export function LinkedExperienceLine({ experience }: { experience: LinkableExperience }) {
  const { t } = useTranslation('candidates')
  const label = useExperienceLabel()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
      <Briefcase size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
      {/* The icon alone would not say WHAT this line is — an sr-only prefix names it
          for screen readers without adding visual noise (§6: an icon is never the
          only signal). */}
      <span className="sr-only">{t('references.linkedExperience')}</span>
      <span>{label(experience)}</span>
    </div>
  )
}

/** Calm explanation instead of an empty picker: a candidate without a single work
 *  experience has nothing to link, and an empty dropdown is a dead button (§3). */
export function NoExperiencesNotice() {
  const { t } = useTranslation('candidates')
  return (
    <div data-testid="reference-no-experiences"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 10, padding: '8px 10px',
        borderRadius: 8, background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)',
      }}>
      <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>
        {t('references.noExperiencesToLink')}
      </span>
    </div>
  )
}
