/**
 * GenerateDescriptionFlow — see the fuller docblock below, right above the
 * component, for the "Genereer met Koios" create-form flow it renders. The
 * loading/error/success status panel is the shared GenerateFlowStatus
 * (components/ui/) — only the idle entry button and the resolving/profile-chip
 * header stay entity-specific (this form has no `base_vacancy_id` yet, so its
 * generation profile is resolved live rather than seeded server-side).
 */
import { useTranslation } from 'react-i18next'
import { Sparkles, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Button from '@/components/ui/Button'
import GenerateFlowStatus from '@/components/ui/GenerateFlowStatus'
// HUISSTIJL-1: the status chip line (11px/muted) is the shared Caption atom.
import { Caption } from '@/components/ui/typography'
import { useGenerateDescription } from './useGenerateDescription'
import type { GenerateFormFields } from './useGenerateDescription'

interface GenerateDescriptionFlowProps {
  fields: GenerateFormFields
  // Feeds the concept into the form's own description draft (never a silent
  // overwrite) — the caller decides what "apply" means (open the editor + seed it).
  onApply: (concept: string) => void
}

/**
 * GenerateDescriptionFlow — punt 17: "Genereer met Koios" on the CREATE form's
 * Vacaturetekst card. Mirrors the drawer's VacancyGenerateFlow (same transparency
 * chip + review-before-apply UX, §3A/§3), but the entry button is disabled with
 * an honest title until the fields the endpoint needs (a job title to write
 * about) are filled — this form has no `base_vacancy_id` yet, so there is no
 * server-side seed to fall back on the way the drawer's edit flow has.
 */
export default function GenerateDescriptionFlow({ fields, onApply }: GenerateDescriptionFlowProps) {
  const { t } = useTranslation('vacancies')
  const { open, openFlow, closeFlow, profile, resolving, resolveFailed, noProfileConfigured, status, concept, generate, discard } = useGenerateDescription(fields)
  const canGenerate = fields.title.trim().length > 0

  // Idle — just the entry button; disabled (with an honest reason) until a title exists.
  if (!open) {
    return (
      <Button variant="soft" size="sm" onClick={openFlow} disabled={!canGenerate}
        aria-label={t('generate.button')} title={canGenerate ? undefined : t('generate.needsTitleFirst')}
        style={{ marginBottom: 8 }}>
        <KoiosAiMark size={16} tone="soft" title={t('generate.button')} />
        {t('generate.button')}
      </Button>
    )
  }

  return (
    <div role="region" aria-label={t('generate.button')}
      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8,
        background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header row: read-only transparency chip + close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Caption as="div">
          {resolving && t('generate.resolving')}
          {!resolving && profile && t('generate.profileChip', { name: profile.name, specificity: profile.specificity })}
          {!resolving && resolveFailed && t('common:error.title')}
        </Caption>
        <Button variant="ghost" iconOnly size="sm" onClick={closeFlow} aria-label={t('common:close')}>
          <X size={14} />
        </Button>
      </div>

      {/* No generation profile configured for this tenant at all — honest notice, no dead button. */}
      {noProfileConfigured && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('generate.noProfile')}</div>
      )}

      {status === 'idle' && !noProfileConfigured && (
        <Button variant="primary" size="sm" onClick={generate} disabled={resolving || resolveFailed} style={{ alignSelf: 'flex-start' }}>
          <Sparkles size={13} /> {t('generate.cta')}
        </Button>
      )}

      {status === 'noProfile' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('generate.noProfile')}</div>
      )}

      <GenerateFlowStatus status={status} concept={concept} onRetry={generate}
        onApply={() => { onApply(concept); closeFlow() }} onDiscard={discard} t={t} />
    </div>
  )
}
