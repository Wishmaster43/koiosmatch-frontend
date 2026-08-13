import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { Loader2, Sparkles, X, Check } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import CalloutBox from '@/components/ui/CalloutBox'
import { useGenerateDescription } from './useGenerateDescription'
import type { GenerateFormFields } from './useGenerateDescription'

interface GenerateDescriptionFlowProps {
  fields: GenerateFormFields
  // Feeds the concept into the form's own description draft (never a silent
  // overwrite) — the caller decides what "apply" means (open the editor + seed it).
  onApply: (concept: string) => void
}

const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
  padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }
const ghostBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
  padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }
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
      <button type="button" onClick={openFlow} disabled={!canGenerate}
        aria-label={t('generate.button')} title={canGenerate ? undefined : t('generate.needsTitleFirst')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '5px 10px',
          borderRadius: 7, cursor: canGenerate ? 'pointer' : 'not-allowed', opacity: canGenerate ? 1 : 0.55,
          background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)', marginBottom: 8 }}>
        <KoiosAiMark size={16} tone="soft" title={t('generate.button')} />
        {t('generate.button')}
      </button>
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
        <button type="button" onClick={closeFlow} aria-label={t('common:close')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      {/* No generation profile configured for this tenant at all — honest notice, no dead button. */}
      {noProfileConfigured && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('generate.noProfile')}</div>
      )}

      {status === 'idle' && !noProfileConfigured && (
        <button type="button" onClick={generate} disabled={resolving || resolveFailed} style={{ ...primaryBtn, opacity: (resolving || resolveFailed) ? 0.6 : 1, alignSelf: 'flex-start' }}>
          <Sparkles size={13} /> {t('generate.cta')}
        </button>
      )}

      {status === 'loading' && (
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" /> {t('generate.generating')}
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
            <button type="button" onClick={() => { onApply(concept); closeFlow() }} style={primaryBtn}>
              <Check size={13} /> {t('generate.apply')}
            </button>
            <button type="button" onClick={discard} style={ghostBtn}>{t('generate.discard')}</button>
          </div>
        </>
      )}
    </div>
  )
}
