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
import { GroupLabel } from '@/components/ui/typography'
import { askKoios } from '@/lib/koiosBridge'
import type { KoiosContextRef } from '@/types/koios'

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
}

/**
 * KoiosAdviceBlock — the shared "Koios AI adviseert" advisory card reused on
 * every major entity drawer (candidates, vacancies, applications, customers,
 * …). Pure presentational, no data fetching: heading (icon + grey uppercase
 * title + Beta chip + refresh) sits outside the card; insight rows are
 * collapsible dot+label rows, closed by default. §3A blueprint component —
 * extend by passing more `insights`, never fork the look.
 */
export default function KoiosAdviceBlock({ namespace, insights, onRefresh, contextRef }: KoiosAdviceBlockProps) {
  // 'common' alongside the feature namespace — the AI-Act disclosure hint
  // (AI-ACT-1) is shared copy, not per-entity.
  const { t } = useTranslation([namespace, 'common'])
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
                          onClick={() => askKoios(t('common:koios.adviceAskTemplate', { advice: ins.text }), contextRef)}
                          title={t('common:koios.assistant.askKoios')}>
                          {t('common:koios.assistant.askKoios')}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
