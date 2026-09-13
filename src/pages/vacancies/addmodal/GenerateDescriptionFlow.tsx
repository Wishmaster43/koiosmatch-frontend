/**
 * GenerateDescriptionFlow — see the fuller docblock below, right above the
 * component, for the "Genereer met Koios" create-form flow it renders. The
 * loading/error/success status panel is the shared GenerateFlowStatus and the
 * idle-button/open-region chrome is the shared GenerateFlowFrame
 * (components/ui/, components/forms/) — only the entry-button labels, the
 * resolving/profile-chip header and the two status buttons stay entity-
 * specific (this form has no `base_vacancy_id` yet, so its generation profile
 * is resolved live rather than seeded server-side).
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import GenerateFlowFrame from '@/components/forms/GenerateFlowFrame'
import GenerateApplyStatus, { GenerateCtaButton } from '@/components/forms/GenerateApplyStatus'
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

  return (
    <GenerateFlowFrame
      open={open} onOpen={openFlow} canGenerate={canGenerate}
      label={t('generate.button')} disabledTitle={t('generate.needsTitleFirst')}
      header={
        // Header row: read-only transparency chip + close
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
      }
    >
      {/* No generation profile configured for this tenant at all — honest notice, no dead button. */}
      {noProfileConfigured && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('generate.noProfile')}</div>
      )}

      {status === 'idle' && !noProfileConfigured && (
        <GenerateCtaButton onClick={generate} disabled={resolving || resolveFailed} label={t('generate.cta')} />
      )}

      {status === 'noProfile' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('generate.noProfile')}</div>
      )}

      <GenerateApplyStatus status={status} concept={concept} generate={generate}
        onApply={onApply} discard={discard} closeFlow={closeFlow} t={t} />
    </GenerateFlowFrame>
  )
}
