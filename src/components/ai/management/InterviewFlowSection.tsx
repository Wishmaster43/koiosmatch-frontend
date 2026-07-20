/**
 * InterviewFlowSection — read-only summary of the AI-interview design an agent
 * carries (AI-AGENTS-3): name + active badge, intro text, a collapsible system
 * prompt, statuses as soft chips, and the dossier/output fields as a list.
 *
 * Display-only: there is no interview-flow LIST endpoint yet (verified in
 * koiosmatch-api — only the model + a seeder exist), so changing which flow an
 * agent carries isn't wired up from this screen (see AgentForm's report).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import { Badge } from './shared'
import type { InterviewFlow } from '@/types/ai'

// Shared uppercase micro-label style, matching Field's label look.
const sectionLabelStyle: CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

// A dossier field's declared type may not always be a plain string — render safely.
const renderFieldType = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value))

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
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{flow.name}</span>
        <Badge
          label={t(flow.active ? 'ai.agent.interviewFlow.active' : 'ai.agent.interviewFlow.inactive')}
          color={flow.active ? 'var(--color-success)' : 'var(--text-muted)'}
          bg={flow.active
            ? 'color-mix(in srgb, var(--color-success) 14%, transparent)'
            : 'color-mix(in srgb, var(--text-muted) 14%, transparent)'}
        />
      </div>

      {/* Intro message — the first template message a session sends */}
      {flow.intro_template && (
        <div style={{ marginBottom: 10 }}>
          <div style={sectionLabelStyle}>{t('ai.agent.interviewFlow.introLabel')}</div>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{flow.intro_template}</p>
        </div>
      )}

      {/* System prompt — collapsed by default (mirrors VersionList's toggle) */}
      <div style={{ marginBottom: 10 }}>
        <button type="button" onClick={() => setShowPrompt(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {showPrompt ? t('ai.agent.interviewFlow.hidePrompt') : t('ai.agent.interviewFlow.showPrompt')}
          <ChevronDown size={10} style={{ transform: showPrompt ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
        {showPrompt && (
          <pre style={{ marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 11, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto' }}>
            {flow.system_prompt}
          </pre>
        )}
      </div>

      {/* Statuses — soft chips, never solid fills (§4) */}
      {statuses.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={sectionLabelStyle}>{t('ai.agent.interviewFlow.statusesLabel')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {statuses.map(s => <SoftChip key={s} label={s} color="var(--color-primary)" />)}
          </div>
        </div>
      )}

      {/* Dossier/output fields — vertical list (mirrors the candidate skills convention) */}
      {Object.keys(outputFields).length > 0 && (
        <div>
          <div style={sectionLabelStyle}>{t('ai.agent.interviewFlow.outputFieldsLabel')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(outputFields).map(([key, type]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0' }}>
                <span style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>{key}</span>
                <span style={{ color: 'var(--text-muted)' }}>{renderFieldType(type)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
