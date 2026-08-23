/**
 * ProfileGenerateFlow — GENERATE-FIELDS-1: "Genereer met Koios" entry on the
 * create form's profile-text card, calling /ai/koios/generate with the
 * modal's OWN filled fields. Mirrors GenerateDescriptionFlow's review-before-
 * apply UX (§3A) — the concept never lands in the form until the recruiter
 * clicks "Toepassen"; applying stamps the KoiosSuggestionBadge, cleared as
 * soon as the field is edited (same lifecycle as the CV-prefill marks).
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, X, Check } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Spinner from '@/components/ui/Spinner'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import AssistTextPreview from '@/components/ui/richtext/AssistTextPreview'
import { useProfileGenerate } from './useProfileGenerate'
import type { FormState } from '../AddCandidateModal'

interface ProfileGenerateFlowProps {
  form: FormState
  onApply: (concept: string) => void
}

// Layout override for the ghost-variant retry action: link-like footprint (no height/padding).
const linkBtn: CSSProperties = { height: 'auto', padding: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-primary-text)', textDecoration: 'underline' }

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

      {status === 'loading' && (
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <Spinner size={14} /> {t('generate.generating')}
        </div>
      )}

      {/* 503 — a real, temporary outage. */}
      {status === 'unavailable' && (
        <CalloutBox variant="warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{t('common:errors.koiosUnavailable')}</span>
            <Button variant="ghost" size="sm" type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</Button>
          </div>
        </CalloutBox>
      )}

      {/* 402 — tenant AI credit spent; calm warning tone, retry stays enabled. */}
      {status === 'creditExhausted' && (
        <CalloutBox variant="warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{t('common:errors.koiosCreditExhausted')}</span>
            <Button variant="ghost" size="sm" type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</Button>
          </div>
        </CalloutBox>
      )}

      {status === 'error' && (
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger-text)' }}>
          <span>{t('generate.error')}</span>
          <Button variant="ghost" size="sm" type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</Button>
        </div>
      )}

      {status === 'success' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <GroupLabel as="span">{t('generate.previewLabel')}</GroupLabel>
            <AiGeneratedLabel />
          </div>
          {/* Shared readable preview (ASSIST-LEESBAAR-1) — no compareWith: a
              generated concept is not a rewrite of existing text. */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', background: 'var(--bg)' }}>
            <AssistTextPreview text={concept} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" size="sm" onClick={() => { onApply(concept); closeFlow() }}>
              <Check size={13} /> {t('generate.apply')}
            </Button>
            <Button variant="secondary" size="sm" onClick={discard}>{t('generate.discard')}</Button>
          </div>
        </>
      )}
    </div>
  )
}
