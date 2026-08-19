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
import { useProfileGenerate } from './useProfileGenerate'
import type { FormState } from '../AddCandidateModal'

interface ProfileGenerateFlowProps {
  form: FormState
  onApply: (concept: string) => void
}

// HUISSTIJL-1: bare text-link retry action (no border/fill) — not one of the
// house Button identities, kept as its own small link style.
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-primary-text)', textDecoration: 'underline' }

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
        {/* HUISSTIJL-1: bare borderless close icon (ghost identity) — not one of
            the four migrated Button patterns, left as its own minimal control. */}
        <button type="button" onClick={closeFlow} aria-label={t('common:close')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X size={14} />
        </button>
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
            <button type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</button>
          </div>
        </CalloutBox>
      )}

      {/* 402 — tenant AI credit spent; calm warning tone, retry stays enabled. */}
      {status === 'creditExhausted' && (
        <CalloutBox variant="warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{t('common:errors.koiosCreditExhausted')}</span>
            <button type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</button>
          </div>
        </CalloutBox>
      )}

      {status === 'error' && (
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger)' }}>
          <span>{t('generate.error')}</span>
          <button type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</button>
        </div>
      )}

      {status === 'success' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('generate.previewLabel')}</span>
            <AiGeneratedLabel />
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, maxHeight: 200, overflow: 'auto',
            border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', background: 'var(--bg)' }}>
            {concept}
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
