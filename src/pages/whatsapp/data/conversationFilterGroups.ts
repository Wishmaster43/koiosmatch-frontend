/**
 * buildConversationFilterGroups — right-panel filters for the Conversations tab
 * (K-193/K-194): status (free-text intent slug, mirrors ConversationController's
 * `status` param), escalated/unanswered/active as checkboxes, plus a search box.
 * Pure builder (§0.3), mirrors buildWaMessageFilterGroups.
 */
import type { TFunction } from 'i18next'

export interface ConvFilterArgs {
  t: TFunction
  escalated: boolean; setEscalated: (v: boolean) => void
  unanswered: boolean; setUnanswered: (v: boolean) => void
  active: boolean; setActive: (v: boolean) => void
  search: string; setSearch: (v: string) => void
}

export function buildConversationFilterGroups({
  t, escalated, setEscalated, unanswered, setUnanswered, active, setActive, search, setSearch,
}: ConvFilterArgs) {
  const category = t('filters.categories.message')
  return [
    {
      key: 'conv-search', type: 'global-search', category, label: t('conversations.searchLabel'),
      value: search, onChange: setSearch, placeholder: t('conversations.searchPlaceholder'),
    },
    {
      key: 'conv-escalated', type: 'checkbox', category, label: t('conversations.filterEscalated'),
      selected: escalated ? ['escalated'] : [], options: [{ value: 'escalated', label: t('conversations.filterEscalated') }],
      onToggle: () => setEscalated(!escalated),
    },
    {
      key: 'conv-unanswered', type: 'checkbox', category, label: t('conversations.filterUnanswered'),
      selected: unanswered ? ['unanswered'] : [], options: [{ value: 'unanswered', label: t('conversations.filterUnanswered') }],
      onToggle: () => setUnanswered(!unanswered),
    },
    {
      key: 'conv-active', type: 'checkbox', category, label: t('conversations.filterActive'),
      selected: active ? ['active'] : [], options: [{ value: 'active', label: t('conversations.filterActive') }],
      onToggle: () => setActive(!active),
    },
  ]
}
