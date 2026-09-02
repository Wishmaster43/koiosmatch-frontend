/**
 * AgentsTab — side-list + AgentForm, wired to useAgentsData. Presentational
 * only; all fetch/mutation logic lives in the hook (§3).
 */
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import { initialsOf } from '@/lib/initials'
import { SideList, ListRow } from '@/components/ai/management/shared'
import { AgentForm } from '@/components/ai/management/AgentForm'
import { useAgentsData } from '@/components/ai/hooks/useAgentsData'

export function AgentsTab() {
  const { t } = useTranslation('workflows')
  const { agents, selected, setSelected, prompts, faqs, loading, loadError, onSaved, onDelete, dialog } = useAgentsData()

  return (
    <>
      <SideList
        title={t('ai.tabs.agents')} items={agents} selected={selected}
        onSelect={setSelected} onNew={() => setSelected({ _new: true })} loading={loading} error={loadError}
        renderItem={(a, active) => (
          // AI-AGENTS-2: show the linked recruiter/manager user, not a model (removed — MODEL-1).
          <ListRow key={a.id} item={a} active={active} onSelect={setSelected}
            label={a.name} sublabel={a.user?.name}
            leading={a.user ? <Avatar initials={initialsOf(a.user.name)} size={22} soft /> : undefined}
            onDelete={onDelete} />
        )}>
        {selected
          ? <AgentForm agent={selected._new ? null : selected} prompts={prompts} faqs={faqs} onSaved={onSaved} onDelete={onDelete} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, fontSize: 12, color: 'var(--text-muted)' }}>
              {t('ai.agent.selectOrNew')}
            </div>
        }
      </SideList>
      {dialog}
    </>
  )
}
