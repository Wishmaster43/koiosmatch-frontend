/**
 * AgentKnowledgeSection — the agent form's "Kennisbank" block: the general-knowledge
 * toggle, which FAQs an agent may draw on, and (KNOWLEDGE-SCOPE-1, K-276) which
 * knowledge items it is coupled to. Extracted from AgentForm to keep that container
 * under the file-size target (§3) — purely presentational, all state/handlers are
 * owned by the caller.
 */
import { useTranslation } from 'react-i18next'
import { KNOWLEDGE_IDS_MAX } from './agentLimits'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import Toggle from '@/components/ui/Toggle'
import { Caption, GroupLabel } from '@/components/ui/typography'
import { Field } from './shared'
import type { AiItem, AiKnowledgeLookupItem } from '@/types/ai'

interface AgentKnowledgeSectionProps {
  useKnowledge: boolean
  onUseKnowledgeChange: (v: boolean) => void
  faqs: AiItem[]
  faqIds: Array<string | number>
  onToggleFaq: (id: string | number) => void
  knowledgeItems: AiKnowledgeLookupItem[]
  knowledgeIds: string[]
  onToggleKnowledgeItem: (id: string) => void
  // KNOWLEDGE-SCOPE-1: true once the 200-id contract cap is reached (guard lives
  // in AgentForm's toggle handler; this only decides whether to show the notice).
  atMax: boolean
}

// Renders the FAQ picker (existing) and the knowledge-item picker (KNOWLEDGE-SCOPE-1)
// side by side under the same "Kennisbank" group, each a soft-chip multiselect over
// its own tenant option list — never a hardcoded vocabulary.
export function AgentKnowledgeSection({
  useKnowledge, onUseKnowledgeChange, faqs, faqIds, onToggleFaq,
  knowledgeItems, knowledgeIds, onToggleKnowledgeItem, atMax,
}: AgentKnowledgeSectionProps) {
  const { t } = useTranslation('workflows')
  return (
    <div style={{ marginBottom: 13 }}>
      <GroupLabel style={{ marginBottom: 8 }}>
        {t('ai.agent.knowledge')}
      </GroupLabel>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
        <Toggle checked={useKnowledge} onChange={onUseKnowledgeChange} ariaLabel={t('ai.agent.useKnowledge')} />
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('ai.agent.useKnowledge')}</span>
      </label>
      {/* Repair-pass a11y fix: Field's htmlFor→cloneElement only reaches a SINGLE
          child element, and ChipMultiSelect never accepted that id anyway (it has
          no `id` prop) — so the group had no accessible name at all. Pass ariaLabel
          straight to ChipMultiSelect instead (house precedent: KoiosFeedback.tsx,
          PackagesCard.tsx), for both pickers below. Field's own <label> stays for
          the visible caption only. */}
      <Field label={t('ai.agent.selectFaqs')}>
        {faqs.length === 0
          ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('ai.agent.noFaqs')}</p>
          : (
            <ChipMultiSelect
              options={faqs.map(f => ({ value: String(f.id), label: f.name ?? '' }))}
              selected={faqIds.map(String)}
              onToggle={onToggleFaq}
              ariaLabel={t('ai.agent.selectFaqs')}
            />
          )}
      </Field>
      {/* KNOWLEDGE-SCOPE-1: an empty coupling genuinely means no knowledge text on
          chat/test/interview — the hint says so explicitly rather than implying a
          silent fallback to the full tenant knowledge base. */}
      <Field label={t('ai.agent.knowledgeItems')}>
        {knowledgeItems.length === 0
          ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('ai.agent.noKnowledgeItems')}</p>
          : (
            <ChipMultiSelect
              options={knowledgeItems}
              selected={knowledgeIds.map(String)}
              onToggle={onToggleKnowledgeItem}
              ariaLabel={t('ai.agent.knowledgeItems')}
            />
          )}
        {/* Linked-count summary as an always-mounted polite live region (repair-pass
            a11y fix): a node that mounts/unmounts on every toggle would not reliably
            announce to assistive tech, so the wrapper div stays put and only its
            text content changes. Never concatenated with the hint below — two
            separate translated lines, no string-joining across i18n keys. */}
        <div role="status" aria-live="polite">
          <Caption as="p" style={{ margin: '6px 0 0' }}>
            {knowledgeIds.length > 0 ? t('ai.agent.knowledgeItemsCount', { count: knowledgeIds.length }) : ''}
          </Caption>
        </div>
        {/* Contract cap notice (KNOWLEDGE-SCOPE-1: max 200 ids) — only shown once reached. */}
        {atMax && (
          <Caption as="p" style={{ margin: '4px 0 0' }}>
            {t('ai.agent.knowledgeItemsMax', { max: KNOWLEDGE_IDS_MAX })}
          </Caption>
        )}
        <Caption as="p" style={{ margin: '4px 0 0' }}>
          {t('ai.agent.knowledgeItemsHint')}
        </Caption>
      </Field>
    </div>
  )
}
