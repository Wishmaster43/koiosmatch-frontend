/**
 * KoiosAssistantBlock — the assistant's opening move on the Koios panel's
 * landing state (KOIOS-ASSISTANT-FE-1, §0B: "an assistant finishes the
 * loop"). Renders GET /ai/koios/assistant's suggestions IN SERVER ORDER
 * (already urgency-sorted, never re-sorted here) as calm cards mirroring the
 * KoiosPendingActionCard visual family. Mounted above KoiosRadar — the
 * assistant speaks first, the attention signals follow. Collapsible via the
 * shared CollapsedCard, its own persisted storage key (mirrors
 * useKoiosRadarCollapse's convention exactly, one key per card).
 *
 * The execute seam for `suggestion.action` is not contracted yet (§3: no fake
 * affordances) — a suggestion that carries an action only shows an honest
 * "action available" hint chip, never a dead button.
 */
import { useTranslation } from 'react-i18next'
import { Clock, UserX, Target, Briefcase, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CollapsedCard from '@/components/ui/CollapsedCard'
import { Caption, BodyText } from '@/components/ui/typography'
import SoftChip from '@/components/ui/SoftChip'
import ErrorBanner from '@/components/ui/ErrorBanner'
import KoiosResultCards from './KoiosResultCards'
import { useKoiosAssistant } from './useKoiosAssistant'
import { useKoiosRadarCollapse } from './useKoiosRadarCollapse'
import type { KoiosAssistantKind, KoiosAssistantSuggestion } from './useKoiosAssistant'

// Icon + semantic-token colour per suggestion kind (§4: colour carries meaning, never decoration).
const KIND_META: Record<KoiosAssistantKind, { Icon: LucideIcon; color: string }> = {
  pending_action:            { Icon: Sparkles,  color: 'var(--color-primary)' },
  task_overdue:              { Icon: Clock,      color: 'var(--color-warning-text)' },
  candidate_no_contact:      { Icon: UserX,      color: 'var(--color-warning-text)' },
  opportunity_closing_soon:  { Icon: Target,     color: 'var(--color-info)' },
  vacancy_zero_applications: { Icon: Briefcase,  color: 'var(--text-muted)' },
}

// One suggestion card: kind icon + title + body, its refs via the shared
// KoiosResultCards (deep-links + DATUM-1 already handled there), and an honest
// "action available" hint chip when the server attached a proposed tool call.
function SuggestionCard({ suggestion }: { suggestion: KoiosAssistantSuggestion }) {
  const { t } = useTranslation('common')
  const meta = KIND_META[suggestion.kind] ?? KIND_META.pending_action
  const Icon = meta.Icon
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: 20, height: 20, borderRadius: 6, color: meta.color }}>
          <Icon size={13} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{suggestion.title}</span>
      </div>
      <BodyText style={{ marginLeft: 28 }}>{suggestion.body}</BodyText>
      {suggestion.refs.length > 0 && (
        <div style={{ marginLeft: 28 }}>
          <KoiosResultCards refs={suggestion.refs} />
        </div>
      )}
      {suggestion.action && (
        <div style={{ marginLeft: 28, marginTop: 2 }}>
          <SoftChip label={t('koios.assistant.actionAvailable')} color="var(--color-primary)" />
        </div>
      )}
    </div>
  )
}

// The Koios panel's landing-state assistant block: server-side suggestions rendered in order, collapsible via a persisted per-user choice.
export default function KoiosAssistantBlock() {
  const { t } = useTranslation('common')
  const { collapsed, setCollapsed } = useKoiosRadarCollapse('koios.assistant.collapsed')
  // Only fetches while actually rendered — the panel only mounts this block on the landing state.
  const { suggestions, loading, error, refetch } = useKoiosAssistant()
  const hasSuggestions = !loading && !error && suggestions.length > 0

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', padding: '10px 14px' }}>
      <CollapsedCard
        title={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('koios.assistant.title')}</span>}
        filled={hasSuggestions}
        open={!collapsed}
        onOpenChange={(open) => setCollapsed(!open)}
      >
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
          <div style={{ margin: '4px 0 0', display: 'flex', flexDirection: 'column' }}>
            {suggestions.map((s, i) => <SuggestionCard key={i} suggestion={s} />)}
          </div>
        )}
      </CollapsedCard>
    </div>
  )
}
