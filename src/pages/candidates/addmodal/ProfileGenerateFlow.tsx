/**
 * ProfileGenerateFlow — GENERATE-FIELDS-1: "Genereer met Koios" entry on the
 * create form's profile-text card, calling /ai/koios/generate with the
 * modal's OWN filled fields. Mirrors GenerateDescriptionFlow's review-before-
 * apply UX (§3A) — the concept never lands in the form until the recruiter
 * clicks "Toepassen"; applying stamps the KoiosSuggestionBadge, cleared as
 * soon as the field is edited (same lifecycle as the CV-prefill marks). The
 * loading/error/success status panel is the shared GenerateFlowStatus
 * (components/ui/) — only the idle entry button stays entity-specific.
 */
import { useTranslation } from 'react-i18next'
import { Sparkles, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Button from '@/components/ui/Button'
import GenerateFlowStatus from '@/components/ui/GenerateFlowStatus'
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

  if (!open) {
    return (
      <Button variant="soft" size="sm" onClick={openFlow} disabled={!canGenerate}
        aria-label={t('generate.button')} title={canGenerate ? undefined : t('generate.needsFieldsFirst')}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" iconOnly type="button" onClick={closeFlow} aria-label={t('common:close')}
          style={{ width: 'auto', height: 'auto', padding: 0 }}>
          <X size={14} />
        </Button>
      </div>

      {status === 'idle' && (
        <Button variant="primary" size="sm" onClick={generate} style={{ alignSelf: 'flex-start' }}>
          <Sparkles size={13} /> {t('generate.cta')}
        </Button>
      )}

      <GenerateFlowStatus status={status} concept={concept} onRetry={generate}
        onApply={() => { onApply(concept); closeFlow() }} onDiscard={discard} t={t} />
    </div>
  )
}
