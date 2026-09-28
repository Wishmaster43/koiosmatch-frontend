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

export type { AskKoios }

// The Koios panel's assistant block: server-side suggestions rendered in order, collapsible via a persisted per-user choice.
export default function KoiosAssistantBlock({ onAskKoios, onClose }: { onAskKoios?: AskKoios; onClose?: () => void }) {
  const { t } = useTranslation('common')
  const { collapsed, setCollapsed } = useKoiosRadarCollapse('koios.assistant.collapsed')
  const { suggestions, loading, error, refetch } = useKoiosAssistant()
  const hasSuggestions = !loading && !error && suggestions.length > 0
  const queryClient = useQueryClient()
  // After an executed or cancelled action the list and the dashboard's "Koios did this
  // for you" read the server again (a resolved parked action must leave the list).
  const onDone = () => {
    void refetch()
    void queryClient.invalidateQueries({ queryKey: ['koios', 'for-you'] })
  }

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
      {!loading && !error && suggestions.length === 0 && (
        <Caption style={{ display: 'block', margin: '6px 0 0' }}>{t('koios.assistant.emptyState')}</Caption>
      )}
      {!loading && !error && suggestions.length > 0 && (
        // The list scrolls inside the block (max ~half the panel) so the advice block
        // below stays reachable when the backend returns its full ten suggestions.
        <div style={{ margin: '4px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '48vh', overflowY: 'auto' }}>
          {suggestions.map(s => <KoiosSuggestionRow key={suggestionKey(s)} suggestion={s} onAskKoios={onAskKoios} onDone={onDone} />)}
        </div>
      )}
    </KoiosCardFrame>
  )
}
