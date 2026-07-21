import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { Loader2, Sparkles, X, Check } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { useVacancyGenerate } from '../hooks/useVacancyGenerate'
import type { VacancyDetail } from '@/types/vacancy'

interface VacancyGenerateFlowProps {
  vacancy: VacancyDetail
  // Feeds the concept into the EXISTING description pencil→save editor (the
  // caller opens edit mode + seeds the draft) — never a direct onUpdate/PATCH.
  onApply: (concept: string) => void
}

const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
  padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'var(--color-primary)', color: '#fff', border: 'none' }
const ghostBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
  padding: '6px 12px', borderRadius: 7, cursor: 'pointer', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }

/**
 * VacancyGenerateFlow — "Genereer met Koios" on the vacancy description
 * (VACGEN-1 fase 1b). Resolves the tenant's best-matching generation profile
 * for this vacancy and shows it as a READ-ONLY transparency chip — there is
 * deliberately no override picker in v1: `GET /vacancy-generation-profiles`
 * (the full list an override would need) is gated behind the admin-only
 * `vacancy_generation.manage` permission, which most vacancy-creators lack.
 * Building a picker that 403s for most users would be a fake affordance (§3);
 * the spec explicitly allows shipping transparency-only as the smallest
 * correct v1. Secondary/ghost styling throughout — this is a helper action next
 * to the description field, never the primary CTA on the tab.
 *
 * Generate returns a CONCEPT; "Toepassen" only feeds it into the caller's
 * existing pencil→save draft (never a silent overwrite of the saved text).
 */
export default function VacancyGenerateFlow({ vacancy, onApply }: VacancyGenerateFlowProps) {
  const { t } = useTranslation('vacancies')
  const { open, openFlow, closeFlow, profile, resolving, resolveFailed, noProfileConfigured, status, concept, generate, discard } = useVacancyGenerate(vacancy)

  // Idle — just the entry button (mirrors the "not published yet" ghost-link footprint).
  if (!open) {
    return (
      <button type="button" onClick={openFlow} aria-label={t('generate.button')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '5px 10px',
          borderRadius: 7, cursor: 'pointer', background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
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

      {status === 'unavailable' && (
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-warning)' }}>
          <span>{t('generate.unavailable')}</span>
          <button type="button" onClick={generate} style={linkBtn}>{t('common:error.retry')}</button>
        </div>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('generate.previewLabel')}</div>
          {/* Plain text (the backend returns prose, not HTML) — rendered as text
              content, never dangerouslySetInnerHTML (§7): no HTML injection
              surface exists here at all. */}
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
