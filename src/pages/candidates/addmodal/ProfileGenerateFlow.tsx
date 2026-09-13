/**
 * ProfileGenerateFlow — GENERATE-FIELDS-1: "Genereer met Koios" entry on the
 * create form's profile-text card, calling /ai/koios/generate with the
 * modal's OWN filled fields. Mirrors GenerateDescriptionFlow's review-before-
 * apply UX (§3A) — the concept never lands in the form until the recruiter
 * clicks "Toepassen"; applying stamps the KoiosSuggestionBadge, cleared as
 * soon as the field is edited (same lifecycle as the CV-prefill marks). The
 * loading/error/success status panel is the shared GenerateFlowStatus and the
 * idle-button/open-region chrome is the shared GenerateFlowFrame
 * (components/ui/, components/forms/) — only this header row and the two
 * status buttons stay entity-specific.
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import GenerateFlowFrame from '@/components/forms/GenerateFlowFrame'
import GenerateApplyStatus, { GenerateCtaButton } from '@/components/forms/GenerateApplyStatus'
import { useProfileGenerate } from './useProfileGenerate'
import type { FormState } from '../AddCandidateModal'

interface ProfileGenerateFlowProps {
  form: FormState
  onApply: (concept: string) => void
}

export default function ProfileGenerateFlow({ form, onApply }: ProfileGenerateFlowProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const { open, openFlow, closeFlow, status, concept, generate, discard } = useProfileGenerate(form)
  const canGenerate = form.firstName.trim().length > 0 || form.functionTitle.trim().length > 0

  return (
    <GenerateFlowFrame
      open={open} onOpen={openFlow} canGenerate={canGenerate}
      label={t('generate.button')} disabledTitle={t('generate.needsFieldsFirst')}
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" iconOnly type="button" onClick={closeFlow} aria-label={t('common:close')}
            style={{ width: 'auto', height: 'auto', padding: 0 }}>
            <X size={14} />
          </Button>
        </div>
      }
    >
      {status === 'idle' && <GenerateCtaButton onClick={generate} label={t('generate.cta')} />}

      <GenerateApplyStatus status={status} concept={concept} generate={generate}
        onApply={onApply} discard={discard} closeFlow={closeFlow} t={t} />
    </GenerateFlowFrame>
  )
}
