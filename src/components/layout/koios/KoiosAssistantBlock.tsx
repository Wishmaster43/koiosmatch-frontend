/**
 * KoiosAssistantBlock — the assistant's opening move on the Koios panel
 * (KOIOS-ASSISTANT-FE-1, §0B: "an assistant finishes the loop"). Renders
 * GET /ai/koios/assistant's suggestions IN SERVER ORDER (already urgency-sorted,
 * never re-sorted here). Collapsible via the shared CollapsedCard, its own
 * persisted storage key (mirrors useKoiosRadarCollapse's convention).
 *
 * Danny 09-09 (live review, evening): ONE compact row per suggestion — the deep-link
 * chip IS the title, the reason sits beside it, the actions on the same line; every
 * row wears the same two actions (Execute + a chat icon), never a filled button on
 * one row and a link on the next; a confirmed action shows the record it created as
 * a chip (§0B), and the chat handoff carries the record ref + the reason, so Koios
 * knows who and why ("Koios has no idea what this is about").
 *
 * Danny 10-09 (live review, Kelly's panel): KOIOS-ROW-2 — Execute executes in ONE
 * click when the tool registry does not require a confirm, a tool switched off for
 * the organisation or for this user renders no Execute at all, an executed search
 * jumps to the record, and the list plus the dashboard's "Koios did this for you"
 * refetch after every executed or cancelled action.
 *
 * Danny 24-09 (screenshot, EN user Kelly seeing NL prose): KOIOS-SUGGEST-COMPACT-1 —
 * the per-row rendering (icon, reason, actions) now lives in `KoiosSuggestionRow`;
 * this block is left as a thin list container so it never grows past ~300 lines again.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import KoiosCardFrame from './KoiosCardFrame'
import { Caption } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { useKoiosAssistant } from './useKoiosAssistant'
import { useKoiosRadarCollapse } from './useKoiosRadarCollapse'
import { useQueryClient } from '@tanstack/react-query'
import KoiosSuggestionRow from './KoiosSuggestionRow'
import type { AskKoios } from './KoiosSuggestionRow'
import { suggestionKey } from './koiosSuggestionMeta'
import { notifySuccess } from '@/lib/notify'

export type { AskKoios }

// A dismissed row reappears if the refetched list still carries it (KOIOS-SUGGEST-
// COMPACT-2, Danny 28-09: "Create taak annuleren en blijft staan"): the server is the
// truth, this is only a brief grace window so a resolved row never lingers with stale
// "Cancelled."/"Executed." text while the refetch is in flight.
const REAPPEAR_MS = 1500

// The Koios panel's assistant block: server-side suggestions rendered in order, collapsible via a persisted per-user choice.
export default function KoiosAssistantBlock({ onAskKoios, onClose }: { onAskKoios?: AskKoios; onClose?: () => void }) {
  const { t } = useTranslation('common')
  const { collapsed, setCollapsed } = useKoiosRadarCollapse('koios.assistant.collapsed')
  const { suggestions, loading, error, refetch } = useKoiosAssistant()
  const hasSuggestions = !loading && !error && suggestions.length > 0
  const queryClient = useQueryClient()
  // Keys hidden from the list right after their action resolved, so a completed row
  // never sits there with stale text waiting for the refetch to catch up.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  // After an executed or cancelled action: drop the row immediately, toast the result,
  // and refetch the list + the dashboard's "Koios did this for you" (a resolved parked
  // action must leave both). The dismiss is only a grace window — see REAPPEAR_MS.
  const onDone = (key: string, result: 'executed' | 'cancelled') => {
    setDismissed(prev => new Set(prev).add(key))
    notifySuccess(t(result === 'executed' ? 'koios.assistant.doneExecuted' : 'koios.assistant.doneCancelled'))
    void refetch()
    void queryClient.invalidateQueries({ queryKey: ['koios', 'for-you'] })
    setTimeout(() => {
      setDismissed(prev => { const next = new Set(prev); next.delete(key); return next })
    }, REAPPEAR_MS)
  }
  const visibleSuggestions = suggestions.filter(s => !dismissed.has(suggestionKey(s)))

  return (
    <KoiosCardFrame title={t('koios.assistant.title')} filled={hasSuggestions} open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)} onClose={onClose} closeLabel={t('close')}>
      {/* Four explicit UI states: loading / error / empty / non-zero suggestion rows. */}
      {loading && (
        <Caption style={{ display: 'block', margin: '6px 0 0' }}>{t('loading')}</Caption>
      )}
      {!loading && error && (
        <ErrorBanner variant="subtle" onRetry={() => refetch()} style={{ margin: '4px 0 0' }}>
          {t('error.body')}
        </ErrorBanner>
      )}
      {!loading && !error && visibleSuggestions.length === 0 && (
        <Caption style={{ display: 'block', margin: '6px 0 0' }}>{t('koios.assistant.emptyState')}</Caption>
      )}
      {!loading && !error && visibleSuggestions.length > 0 && (
        // The list scrolls inside the block (max ~half the panel) so the advice block
        // below stays reachable when the backend returns its full ten suggestions.
        <div style={{ margin: '4px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '48vh', overflowY: 'auto' }}>
          {visibleSuggestions.map(s => <KoiosSuggestionRow key={suggestionKey(s)} suggestion={s} onAskKoios={onAskKoios} onDone={(result) => onDone(suggestionKey(s), result)} />)}
        </div>
      )}
    </KoiosCardFrame>
  )
}
