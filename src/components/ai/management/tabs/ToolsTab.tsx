/**
 * ToolsTab — read-only, honest tool checklist. Unchanged from the pre-split
 * AIManagementTabs.tsx: no `tools` field on AiAgent, no persistence route yet.
 */
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

// Built-in tool ids; label/description come from t('ai.tools.items.<id>.*').
const BUILTIN_TOOLS = ['shift_lookup', 'candidate_status', 'send_whatsapp', 'update_candidate', 'knowledge_search', 'calendar_check']
// Which tools ship enabled by default — display-only until the backend exists (see below).
const DEFAULT_ENABLED_TOOLS = new Set(['shift_lookup', 'knowledge_search'])

// AUDIT 2026-07-28 (fake affordance, §3): this used to be a clickable toggle whose
// state lived only in this component and was never sent anywhere — no `tools` field
// on AiAgent, no /ai/agents/{id}/tools route (verified against api-generated.ts).
// Toggling looked like a per-agent save but reset to the same two defaults on every
// remount. Render it read-only with an honest notice instead of faking a save;
// wire it up for real once the backend ships the endpoint (report, don't fake it).
export function ToolsTab() {
  const { t } = useTranslation('workflows')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('ai.tools.hint')}</p>
      <p style={{ fontSize: 11, color: 'var(--color-warning-text)', marginBottom: 4 }}>{t('ai.tools.notAvailable')}</p>
      {BUILTIN_TOOLS.map(toolId => {
        const on = DEFAULT_ENABLED_TOOLS.has(toolId)
        return (
          <div key={toolId} aria-disabled="true"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'not-allowed', opacity: 0.7,
              background: on ? 'var(--color-primary-bg)' : 'var(--bg)',
              border: `1px solid ${on ? 'var(--color-primary)' : 'var(--border)'}` }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`, background: on ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {on && <Check size={9} color="white" />}
            </div>
            <div>
              {/* Text-colour accent uses the AA-contrast text token, not the raw brand primary. */}
              <div style={{ fontSize: 12, fontWeight: 500, color: on ? 'var(--color-primary-text)' : 'var(--text)' }}>{t(`ai.tools.items.${toolId}.label`)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t(`ai.tools.items.${toolId}.description`)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
