import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { Sparkles, X, Check } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Spinner from '@/components/ui/Spinner'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import { useGenerateDescription } from './useGenerateDescription'
import type { GenerateFormFields } from './useGenerateDescription'

interface GenerateDescriptionFlowProps {
  fields: GenerateFormFields
  // Feeds the concept into the form's own description draft (never a silent
  // overwrite) — the caller decides what "apply" means (open the editor + seed it).
  onApply: (concept: string) => void
}

// HUISSTIJL-1: a genuine text link (underlined, no chrome) — not a Button variant.
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-primary-text)', textDecoration: 'underline' }

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
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {resolving && t('generate.resolving')}
          {!resolving && profile && t('generate.profileChip', { name: profile.name, specificity: profile.specificity })}
          {!resolving && resolveFailed && t('common:error.title')}
        </div>
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

      {status === 'loading' && (
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <Spinner size={14} /> {t('generate.generating')}
        </div>
      )}

      {/* 503 — genuinely down right now; honest outage copy, no credit wording. */}
      {status === 'unavailable' && (
        <CalloutBox variant="warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{t('common:errors.koiosUnavailable')}</span>
            <button type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</button>
          </div>
        </CalloutBox>
      )}

      {/* 402 — tenant credit spent/not activated; calm warning tone (never red), retry stays enabled. */}
      {status === 'creditExhausted' && (
        <CalloutBox variant="warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{t('common:errors.koiosCreditExhausted')}</span>
            <button type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</button>
          </div>
        </CalloutBox>
      )}

      {status === 'noProfile' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('generate.noProfile')}</div>
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
            {/* AI-Act disclosure (AI-ACT-1): the concept below is Koios-generated content. */}
            <AiGeneratedLabel />
          </div>
          {/* Plain text (the backend returns prose, not HTML) — rendered as text
              content, never dangerouslySetInnerHTML (§7). */}
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
