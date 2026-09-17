/**
 * InterviewFlowSection — read-only summary of the AI-interview design an agent
 * carries (AI-AGENTS-3): name + active badge, intro text, a collapsible system
 * prompt, statuses as soft chips, and the dossier/output fields as a list.
 *
 * Display-only by design, not by missing plumbing: the flow's own CRUD editor
 * now lives in the Flows tab (AIManagementTabs.tsx FlowsTab + InterviewFlowsPanel,
 * GET/POST/PUT/DELETE /ai/interview-flows) — this component stays the compact
 * read-only summary embedded in AgentForm, mirroring which flow that agent uses.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { GroupLabel, SectionTitle, monoStyle } from '@/components/ui/typography'
import { translateInterviewStatus } from '@/lib/interviewStatus'
import type { InterviewFlow } from '@/types/ai'

// A dossier field's declared type may not always be a plain string — render safely.
const renderFieldType = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value))

// Read-only view of an agent's interview-flow design (see file docblock above) —
// display only, since no flow-editing endpoint exists yet.
export function InterviewFlowSection({ flow }: { flow?: InterviewFlow | null }) {
  const { t } = useTranslation('workflows')
  const [showPrompt, setShowPrompt] = useState(false)

  // Empty state: agent has no interview flow linked yet.
  if (!flow) {
    return (
      <div style={{ marginBottom: 13, padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
        {t('ai.agent.interviewFlow.empty')}
      </div>
    )
  }

  const statuses = flow.statuses ?? []
  const outputFields = flow.output_fields ?? {}

  return (
    <div style={{ marginBottom: 13, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
      {/* Name + active/inactive badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <SectionTitle as="span">{flow.name}</SectionTitle>
        <SoftChip round
          label={t(flow.active ? 'ai.agent.interviewFlow.active' : 'ai.agent.interviewFlow.inactive')}
          color={flow.active ? 'var(--color-success)' : 'var(--text-muted)'}
        />
      </div>

      {/* Intro message — the first template message a session sends */}
      {flow.intro_template && (
        <div style={{ marginBottom: 10 }}>
          <GroupLabel style={{ marginBottom: 5 }}>{t('ai.agent.interviewFlow.introLabel')}</GroupLabel>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{flow.intro_template}</p>
        </div>
      )}

      {/* System prompt — collapsed by default (mirrors VersionList's toggle) */}
      <div style={{ marginBottom: 10 }}>
        <Button variant="ghost" size="sm" onClick={() => setShowPrompt(o => !o)}>
          {showPrompt ? t('ai.agent.interviewFlow.hidePrompt') : t('ai.agent.interviewFlow.showPrompt')}
          <ChevronDown size={10} style={{ transform: showPrompt ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </Button>
        {showPrompt && (
          <pre style={{ marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 11, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto' }}>
            {flow.system_prompt}
          </pre>
        )}
      </div>

      {/* Statuses — soft chips, never solid fills (§4). RAW-ENUM-LEAK fix
          (HUISSTIJL-1 batch G): these are flow-authored SCREAMING_SNAKE
          values (e.g. "INTRO_SENT") — run through the shared i18n-first
          lookup so a known engine marker reads as prose, mirroring
          InterviewStatusCard/ApplicationStatusStrip instead of a third copy. */}
      {statuses.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <GroupLabel style={{ marginBottom: 5 }}>{t('ai.agent.interviewFlow.statusesLabel')}</GroupLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {statuses.map(s => <SoftChip key={s} label={translateInterviewStatus(t, s)} color="var(--color-primary)" />)}
          </div>
        </div>
      )}

      {/* Dossier/output fields — vertical list (mirrors the candidate skills convention) */}
      {Object.keys(outputFields).length > 0 && (
        <div>
          <GroupLabel style={{ marginBottom: 5 }}>{t('ai.agent.interviewFlow.outputFieldsLabel')}</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(outputFields).map(([key, type]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0' }}>
                <span style={{ ...monoStyle, color: 'var(--text)' }}>{key}</span>
                <span style={{ color: 'var(--text-muted)' }}>{renderFieldType(type)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
