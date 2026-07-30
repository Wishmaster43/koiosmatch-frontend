/**
 * ScheduleModal — configures a workflow trigger schedule (interval / daily /
 * weekly / monthly / yearly) plus `scheduleLabel`, the human-readable summary
 * shown on the trigger node + button. Extracted from WorkflowCanvasEditor.
 *
 * This file is the modal SHELL only: dialog chrome, the trigger-type selector
 * and the live preview. The pieces live next to it — form state in
 * `useScheduleForm`, the recurrence editor in `ScheduleFields`, the two pickers
 * in `EventCombobox` / `WebhookAgentSelect`, the summary formatter in
 * `scheduleLabel`. `scheduleLabel` is re-exported here because the trigger node
 * imports it from this module.
 *
 * All visible text runs through i18n (workflows:scheduleModal.*); day/month names
 * come from Intl (locale-aware) so there are no hardcoded NL arrays.
 */
import { useTranslation } from 'react-i18next'
import { X, CalendarDays, Play, Zap, Bell, Webhook } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { ScheduleConfig } from '@/types/workflow'
import { EventCombobox } from './EventCombobox'
import { WebhookAgentSelect } from './WebhookAgentSelect'
import { ScheduleFields } from './ScheduleFields'
import { useScheduleForm } from './useScheduleForm'
import { scheduleLabel } from './scheduleLabel'
import { sectionStyle, sectionLabel } from './scheduleModalStyles'

export { scheduleLabel } from './scheduleLabel'

export function ScheduleModal({ trigger, scheduleConfig, onSave, onClose }: {
  trigger?: string; scheduleConfig?: ScheduleConfig | null
  onSave: (trigger: string, cfg: ScheduleConfig | null) => void; onClose: () => void
}) {
  const { t, i18n } = useTranslation('workflows')
  const locale = i18n.language
  const form = useScheduleForm(trigger, scheduleConfig, onSave)
  const { type, setType } = form
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('scheduleModal.title')} tabIndex={-1}
        style={{ width: 'min(820px, 94vw)', background: 'var(--surface)', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color="var(--color-primary)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('scheduleModal.title')}</span>
          </div>
          <button onClick={onClose} aria-label={t('scheduleModal.cancel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Trigger type selector — roomier cards in the wider modal (TRIGGER-POPUP-2) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10 }}>
            {[
              { id: 'manual',    label: t('scheduleModal.trigger.manual'),    desc: t('scheduleModal.trigger.manualDesc'),    Icon: Play },
              { id: 'instant',   label: t('scheduleModal.trigger.instant'),   desc: t('scheduleModal.trigger.instantDesc'),   Icon: Zap },
              { id: 'scheduled', label: t('scheduleModal.trigger.scheduled'), desc: t('scheduleModal.trigger.scheduledDesc'), Icon: CalendarDays },
              { id: 'event',     label: t('scheduleModal.trigger.event'),     desc: t('scheduleModal.trigger.eventDesc'),     Icon: Bell },
              // AI-AGENTS-3: fifth trigger type — this workflow starts on ONE AI
              // agent's own inbound webhook (config key `agent`, matched by name).
              { id: 'webhook',   label: t('scheduleModal.trigger.webhook'),   desc: t('scheduleModal.trigger.webhookDesc'),   Icon: Webhook },
            ].map(({ id, label, desc, Icon: Ic }: { id: string; label: string; desc: string; Icon: LucideIcon }) => (
              <button key={id} type="button" onClick={() => setType(id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  padding: '16px 12px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${type === id ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: type === id ? 'var(--color-primary-bg)' : 'var(--surface)',
                }}>
                <Ic size={22} color={type === id ? 'var(--color-primary)' : 'var(--text-muted)'} />
                <span style={{ fontSize: 13, fontWeight: 600, color: type === id ? 'var(--color-primary)' : 'var(--text)' }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.35 }}>{desc}</span>
              </button>
            ))}
          </div>

          {/* Event picker — searchable, the COMPLETE dispatched catalogue (TRIGGER-POPUP-2) */}
          {type === 'event' && (
            <div style={sectionStyle}>
              <label style={sectionLabel}>{t('scheduleModal.eventLabel')}</label>
              <EventCombobox value={form.eventKey} onChange={form.setEventKey} label={t('scheduleModal.eventLabel')} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{t('scheduleModal.eventHint')}</p>
            </div>
          )}

          {/* Webhook (AI-agent) picker — one agent, one own webhook (AI-AGENTS-3) */}
          {type === 'webhook' && (
            <div style={sectionStyle}>
              <label style={sectionLabel}>{t('scheduleModal.agentLabel')}</label>
              <WebhookAgentSelect value={form.agentName} onChange={form.setAgentName} label={t('scheduleModal.agentLabel')} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('scheduleModal.agentHint')}</p>
            </div>
          )}

          {/* Schedule type — one section card: frequency row + its detail fields */}
          {type === 'scheduled' && <ScheduleFields form={form} />}

          {/* Preview — ALWAYS visible, for every trigger type (TRIGGER-POPUP-2):
              exactly the label the trigger node will show after saving. */}
          <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('scheduleModal.preview')}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {scheduleLabel(t, locale, form.previewTrigger, form.previewCfg)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('scheduleModal.cancel')}</button>
          {/* Disabled (not just clamped) whenever the current config would be unusable —
              e.g. an emptied interval (`+'' === 0`, BUG 3) or a webhook trigger with no
              agent chosen yet (BUG 4) — a hard backstop regardless of blur/focus state. */}
          <button onClick={form.handleSave} disabled={!form.canSave}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, border: 'none', fontWeight: 600,
              background: form.canSave ? 'var(--color-primary)' : 'var(--border)',
              color: form.canSave ? 'white' : 'var(--text-muted)',
              cursor: form.canSave ? 'pointer' : 'not-allowed',
            }}>{t('scheduleModal.save')}</button>
        </div>
      </div>
    </div>
  )
}
