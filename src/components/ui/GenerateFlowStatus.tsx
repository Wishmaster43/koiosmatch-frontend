/**
 * GenerateFlowStatus — the shared "Genereer met Koios" generate→preview→apply
 * status panel (candidates' ProfileGenerateFlow and vacancies'
 * GenerateDescriptionFlow used to hand-copy this block). Renders the loading /
 * unavailable (503) / credit-exhausted (402) / error / success states for a
 * generate flow; the idle entry button and any entity-specific header (e.g. the
 * vacancy flow's resolving/profile-chip row) stay in each caller, since those
 * differ per entity. `t` is passed in rather than resolved here so every string
 * still comes from the CALLER's own default i18n namespace.
 */
import type { CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { Check } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import AssistTextPreview from '@/components/ui/richtext/AssistTextPreview'

export type GenerateFlowStatusValue = 'idle' | 'loading' | 'unavailable' | 'creditExhausted' | 'noProfile' | 'error' | 'success'

interface GenerateFlowStatusProps {
  status: GenerateFlowStatusValue
  concept: string
  // Retries the generate call — bound to the same handler for every retry link.
  onRetry: () => void
  // Zero-arg: the caller pre-binds concept + any of its own follow-up (e.g. closeFlow).
  onApply: () => void
  onDiscard: () => void
  t: TFunction
}

// Layout override for the ghost-variant retry action: link-like footprint (no height/padding).
const linkBtn: CSSProperties = { height: 'auto', padding: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-primary-text)', textDecoration: 'underline' }

// Renders the loading/unavailable/creditExhausted/error/success states of a generate flow (see file doc above); idle/noProfile stay caller-owned.
export default function GenerateFlowStatus({ status, concept, onRetry, onApply, onDiscard, t }: GenerateFlowStatusProps) {
  if (status === 'loading') {
    return (
      <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <Spinner size={14} /> {t('generate.generating')}
      </div>
    )
  }

  // 503 — genuinely down right now; honest outage copy, no credit wording.
  if (status === 'unavailable') {
    return (
      <CalloutBox variant="warning">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{t('common:errors.koiosUnavailable')}</span>
          <Button variant="ghost" size="sm" type="button" onClick={onRetry} style={linkBtn}>{t('common:error.retry')}</Button>
        </div>
      </CalloutBox>
    )
  }

  // 402 — tenant AI credit spent/not activated; calm warning tone (never red), retry stays enabled.
  if (status === 'creditExhausted') {
    return (
      <CalloutBox variant="warning">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{t('common:errors.koiosCreditExhausted')}</span>
          <Button variant="ghost" size="sm" type="button" onClick={onRetry} style={linkBtn}>{t('common:error.retry')}</Button>
        </div>
      </CalloutBox>
    )
  }

  if (status === 'error') {
    return (
      <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger-text)' }}>
        <span>{t('generate.error')}</span>
        <Button variant="ghost" size="sm" type="button" onClick={onRetry} style={linkBtn}>{t('common:error.retry')}</Button>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <GroupLabel as="span">{t('generate.previewLabel')}</GroupLabel>
          {/* AI-Act disclosure (AI-ACT-1): the concept below is Koios-generated content. */}
          <AiGeneratedLabel />
        </div>
        {/* Shared readable preview (ASSIST-LEESBAAR-1) — no compareWith: a
            generated concept is not a rewrite of existing text. */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', background: 'var(--bg)' }}>
          <AssistTextPreview text={concept} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" size="sm" onClick={onApply}>
            <Check size={13} /> {t('generate.apply')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onDiscard}>{t('generate.discard')}</Button>
        </div>
      </>
    )
  }

  return null
}
