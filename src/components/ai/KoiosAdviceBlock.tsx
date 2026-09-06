/**
 * KoiosAdviceBlock — the shared "Koios AI adviseert" (Koios AI advises) advisory card
 * reused on every major entity drawer. Purely presentational, no fetching or AI call
 * here: insights arrive pre-computed from the caller and render as collapsible
 * dot+label rows behind one shared heading (icon, title, beta chip, refresh).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ChevronDown } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { GroupLabel, Caption, Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { askKoios } from '@/lib/koiosBridge'
import type { KoiosContextRef } from '@/types/koios'
import type { KoiosAiAdvice } from '@/lib/koiosAdviceMap'

// S1 K-266/K-267: verdict -> semantic tone, covering every closed vocabulary
// entry from koios_advice.php across the five entities (proceed/review/reject,
// ok/improve, opportunity/risk/stable, renew/at_risk/ending, next_step). An
// unrecognised future value falls back to the neutral tone, never a guess.
const VERDICT_TONE: Record<string, string> = {
  proceed: 'var(--color-success-text)', ok: 'var(--color-success-text)',
  opportunity: 'var(--color-success-text)', renew: 'var(--color-success-text)',
  review: 'var(--color-warning-text)', improve: 'var(--color-warning-text)',
  at_risk: 'var(--color-warning-text)',
  reject: 'var(--color-danger-text)', risk: 'var(--color-danger-text)', ending: 'var(--color-danger-text)',
  stable: 'var(--color-info)', next_step: 'var(--color-info)',
}
const verdictColor = (verdict: string | null | undefined): string =>
  (verdict && VERDICT_TONE[verdict]) || 'var(--text-muted)'

/** One advisory row: a coloured dot + uppercase label (collapsed by default)
 *  that reveals `text` on click. */
export interface KoiosAdviceInsight {
  type: string
  color: string
  text: string
}

interface KoiosAdviceBlockProps {
  // Which feature namespace's `ai.*` keys to read for the heading copy
  // (title/beta/refresh/analyzing) — every entity ships its own translated
  // strings, mirroring the candidates `ai.*` block (§5).
  namespace: string
  insights: KoiosAdviceInsight[]
  // Optional real refresh hook; without one the button just re-plays the
  // "analysing" animation. There is no AI/API call behind this today (the
  // Anthropic credits are empty) — insights are pre-computed FE heuristics
  // passed in by the caller, never fetched here.
  onRefresh?: () => void | Promise<void>
  // Optional context reference for the entity this advice is about (candidate, customer, etc.)
  // — attached to the window event when an advice row's ask-button is clicked.
  contextRef?: KoiosContextRef
  // S1 K-266/K-267 (KOIOS-ADVIES-OVERAL-1): the NEW per-record AI advice cache
  // (`koios_ai_advice`, a REAL Anthropic call, distinct from the deterministic
  // `insights` above). `undefined` = the host doesn't carry this field at all
  // (renders nothing extra, e.g. tasks/opportunities/outreach hosts); `null` =
  // the host carries it but no run has completed yet (empty state).
  aiAdvice?: KoiosAiAdvice | null
  // Starts a REAL advice run (POST .../koios-advice, API-CREDITS-1) — only
  // passed by a host whose reader holds `<entity>.update`. Without it the
  // "Advies vernieuwen" button does not render at all (§3 no fake affordances).
  onRequestAdvice?: () => void
  // True while a just-started run is still being polled — disables the button
  // so a second click can't fire a redundant real AI call.
  advicePending?: boolean
  // A translated notice from the run (already-running / template unavailable /
  // generic failure) — shown so a failed "Advies vernieuwen" click is never silent.
  adviceNotice?: string | null
}

/**
 * KoiosAdviceBlock — the shared "Koios AI adviseert" advisory card reused on
 * every major entity drawer (candidates, vacancies, applications, customers,
 * …). Pure presentational, no data fetching: heading (icon + grey uppercase
 * title + Beta chip + refresh) sits outside the card; insight rows are
 * collapsible dot+label rows, closed by default. §3A blueprint component —
 * extend by passing more `insights`, never fork the look.
 */
export default function KoiosAdviceBlock({
  namespace, insights, onRefresh, contextRef,
  aiAdvice, onRequestAdvice, advicePending = false, adviceNotice,
}: KoiosAdviceBlockProps) {
  // 'common' alongside the feature namespace — the AI-Act disclosure hint
  // (AI-ACT-1) is shared copy, not per-entity.
  const { t } = useTranslation([namespace, 'common'])
  const { formatDateTime } = useDateFormat()
  const [loading, setLoading] = useState(false)
  // Which insight is expanded (null = all collapsed, the default).
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  // Refresh awaits the real callback; without one there is nothing to call, so
  // the button is not rendered at all (§3: no fake affordances, no fake delay).
  const handleRefresh = async () => {
    if (loading || !onRefresh) return
    setLoading(true)
    try {
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Heading outside the block — icon + grey title (like the other sections) + beta + refresh.
          AI-ACT-1: the heading already names "Koios AI adviseert" in visible text, so this is
          NOT a bare icon (§6) — the mark only gains the AI-Act disclosure hint as a tooltip,
          never a second stacked label next to an already-explicit heading. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <KoiosAiMark size={16} title={t('common:aiGeneratedHint', { defaultValue: 'Door Koios AI gegenereerd — controleer voor gebruik.' })} />
        <GroupLabel as="span" style={{ flex: 1 }}>{t('ai.title')}</GroupLabel>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--button-fill)', color: 'var(--button-ink)', fontWeight: 600 }}>{t('ai.beta')}</span>
        {onRefresh && (
          <Button variant="ghost" size="sm" iconOnly aria-label={t('ai.refresh')} disabled={loading} onClick={handleRefresh}>
            <RefreshCw size={12} />
          </Button>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--surface)' }}>
        {loading
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('ai.analyzing')}</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {insights.map((ins, i) => {
                const open = openIdx === i
                return (
                  <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    {/* Collapsed by default: title + chevron; click reveals the text. */}
                    <div onClick={() => setOpenIdx(open ? null : i)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'none', cursor: 'pointer' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ins.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1, textAlign: 'left' }}>{ins.type}</span>
                      <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </div>
                    {/* KOIOS-ADVIES-DOORKLIK-1: the revealed advice line is a plain div
                        with the advice text and a separate ask-Koios button that opens
                        the Koios chat pre-seeded with a context question (never
                        auto-sent, §0B/API-CREDITS-1: the user still presses send). */}
                    {open && (
                      <div style={{ padding: '0 10px 8px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>{ins.text}</span>
                        <Button variant="ghost" size="sm"
                          onClick={() => askKoios(t('common:koios.adviceAskTemplate', { advice: String(ins.text).replace(/[.!?]\s*$/, '') }), contextRef)}
                          title={t('common:koios.assistant.askKoios')}>
                          {t('common:koios.assistant.askKoios')}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
              {/* S1 K-266/K-267: the NEW real-AI advice cache — below the
                  deterministic insights above, inside the same card. Renders
                  only when the host actually carries this field (`aiAdvice`
                  passed at all, even as null); a host that never mounts this
                  prop sees no change at all. */}
              {aiAdvice !== undefined && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aiAdvice ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SoftChip round color={verdictColor(aiAdvice.verdict)}
                          label={aiAdvice.verdict ? t(`common:koios.advice.verdict.${aiAdvice.verdict}`, { defaultValue: aiAdvice.verdict }) : '—'} />
                        {/* EENHEID-LES: this is a 0-100 FIT SCORE (config/koios_advice.php),
                            never a share-of-sum percentage — the raw number, never a '%'. */}
                        {aiAdvice.score != null && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Caption>{t('common:koios.advice.score')}</Caption>
                            <Mono style={{ fontSize: 12, color: 'var(--text)' }}>{aiAdvice.score}</Mono>
                          </span>
                        )}
                        {onRequestAdvice && (
                          <Button variant="secondary" size="sm" disabled={advicePending} onClick={onRequestAdvice} style={{ marginLeft: 'auto' }}>
                            {t('common:koios.advice.refresh')}
                          </Button>
                        )}
                      </div>
                      {/* The advice TEXT is prose from a real LLM call — plain text with
                          preserved line breaks, never raw HTML (never SafeHtml here). */}
                      {aiAdvice.text && (
                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{aiAdvice.text}</div>
                      )}
                      {/* No AiGeneratedLabel here (S1 repair NOTE 4): the heading's own
                          KoiosAiMark above already carries the AI-Act disclosure hint —
                          stacking a second "AI-gegenereerd" label would double the badge. */}
                      {aiAdvice.generatedAt && (
                        <Caption>{t('common:koios.advice.generatedAt', { date: formatDateTime(aiAdvice.generatedAt) })}</Caption>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Caption>{t('common:koios.advice.none')}</Caption>
                      {onRequestAdvice && (
                        <Button variant="secondary" size="sm" disabled={advicePending} onClick={onRequestAdvice}>
                          {t('common:koios.advice.refresh')}
                        </Button>
                      )}
                    </div>
                  )}
                  {advicePending && <Caption>{t('common:koios.advice.pending')}</Caption>}
                  {adviceNotice && <Caption style={{ color: 'var(--color-warning-text)' }}>{adviceNotice}</Caption>}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  )
}
