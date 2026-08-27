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
import { CalendarDays, Play, Zap, Bell, Webhook, CalendarClock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import type { ScheduleConfig } from '@/types/workflow'
import { EventCombobox } from './EventCombobox'
import { WebhookAgentSelect } from './WebhookAgentSelect'
import { ScheduleFields } from './ScheduleFields'
import { DateRelativeFields } from './DateRelativeFields'
import { useScheduleForm } from './useScheduleForm'
import { scheduleLabel } from './scheduleLabel'
import { sectionStyle, sectionLabel } from './scheduleModalStyles'
import { SectionTitle, Caption, GroupLabel, BodyText } from '@/components/ui/typography'
import ModalFooter from '@/components/ui/ModalFooter'

export { scheduleLabel } from './scheduleLabel'

// The modal shell only (see file docblock above) — trigger-type selector, live
// preview and dialog chrome; form state and the recurrence editor live elsewhere.
export function ScheduleModal({ trigger, scheduleConfig, onSave, onClose }: {
  trigger?: string; scheduleConfig?: ScheduleConfig | null
  onSave: (trigger: string, cfg: ScheduleConfig | null) => void; onClose: () => void
}) {
  const { t, i18n } = useTranslation('workflows')
  const locale = i18n.language
  const form = useScheduleForm(trigger, scheduleConfig, onSave)
  const { type, setType } = form

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable
    // header, SE-resize, remembered position; same 820px footprint as before.
    <FloatingPanel open onClose={onClose} ariaLabel={t('scheduleModal.title')}
      persistKey="workflow-schedule" scrollBody={false} width="min(820px, 94vw)"
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={16} color="var(--color-primary)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('scheduleModal.title')}</span>
        </div>
      }>
        <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Trigger type selector — roomier cards in the wider modal (TRIGGER-POPUP-2) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {[
              { id: 'manual',    label: t('scheduleModal.trigger.manual'),    desc: t('scheduleModal.trigger.manualDesc'),    Icon: Play },
              { id: 'instant',   label: t('scheduleModal.trigger.instant'),   desc: t('scheduleModal.trigger.instantDesc'),   Icon: Zap },
              { id: 'scheduled', label: t('scheduleModal.trigger.scheduled'), desc: t('scheduleModal.trigger.scheduledDesc'), Icon: CalendarDays },
              { id: 'event',     label: t('scheduleModal.trigger.event'),     desc: t('scheduleModal.trigger.eventDesc'),     Icon: Bell },
              // AI-AGENTS-3: fifth trigger type — this workflow starts on ONE AI
              // agent's own inbound webhook (config key `agent`, matched by name).
              { id: 'webhook',   label: t('scheduleModal.trigger.webhook'),   desc: t('scheduleModal.trigger.webhookDesc'),   Icon: Webhook },
              // Date-relative trigger (BE live): fires N days before a whitelisted
              // date field (available_again_date / match.end_date).
              { id: 'date_relative', label: t('scheduleModal.trigger.dateRelative'), desc: t('scheduleModal.trigger.dateRelativeDesc'), Icon: CalendarClock },
            ].map(({ id, label, desc, Icon: Ic }: { id: string; label: string; desc: string; Icon: LucideIcon }) => (
              <button key={id} type="button" onClick={() => setType(id)}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- trigger-type CHOICE CARD: a selection surface (CHIP-TINT idiom, chosen = tint + 2px ring, multi-line wrapped description), a face Button deliberately does not model
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  padding: '16px 12px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${type === id ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: type === id ? 'var(--color-primary-bg)' : 'var(--surface)',
                }}>
                {/* Text-colour accent uses the AA-contrast text token, not the raw brand primary. */}
                <Ic size={22} color={type === id ? 'var(--color-primary-text)' : 'var(--text-muted)'} />
                {/* State ink: the selected card carries the accent text token — surface state, not a re-typed identity. */}
                <SectionTitle as="span" style={{ color: type === id ? 'var(--color-primary-text)' : 'var(--text)' }}>{label}</SectionTitle>
                <Caption as="span" style={{ textAlign: 'center', lineHeight: 1.35 }}>{desc}</Caption>
              </button>
            ))}
          </div>

          {/* Event picker — searchable, the COMPLETE dispatched catalogue (TRIGGER-POPUP-2) */}
          {type === 'event' && (
            <div style={sectionStyle}>
              <label style={sectionLabel}>{t('scheduleModal.eventLabel')}</label>
              <EventCombobox value={form.eventKey} onChange={form.setEventKey} label={t('scheduleModal.eventLabel')} />
              <Caption as="p" style={{ marginTop: 8 }}>{t('scheduleModal.eventHint')}</Caption>
            </div>
          )}

          {/* Webhook (AI-agent) picker — one agent, one own webhook (AI-AGENTS-3) */}
          {type === 'webhook' && (
            <div style={sectionStyle}>
              <label style={sectionLabel}>{t('scheduleModal.agentLabel')}</label>
              <WebhookAgentSelect value={form.agentName} onChange={form.setAgentName} label={t('scheduleModal.agentLabel')} />
              <Caption as="p" style={{ marginTop: 6 }}>{t('scheduleModal.agentHint')}</Caption>
            </div>
          )}

          {/* Schedule type — one section card: frequency row + its detail fields */}
          {type === 'scheduled' && <ScheduleFields form={form} />}

          {/* Date-relative — the shared rijtje, same shape as the Automations settings row */}
          {type === 'date_relative' && (
            <div style={sectionStyle}>
              <label style={sectionLabel}>{t('scheduleModal.trigger.dateRelative')}</label>
              <DateRelativeFields dateField={form.dateField} onDateFieldChange={form.setDateField}
                days={form.offsetDays} onDaysChange={form.setOffsetDays} />
            </div>
          )}

          {/* Preview — ALWAYS visible, for every trigger type (TRIGGER-POPUP-2):
              exactly the label the trigger node will show after saving. */}
          <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <GroupLabel style={{ fontSize: 10, letterSpacing: '0.06em', marginBottom: 4 }}>{t('scheduleModal.preview')}</GroupLabel>
            <BodyText style={{ fontWeight: 500 }}>
              {scheduleLabel(t, locale, form.previewTrigger, form.previewCfg)}
            </BodyText>
          </div>
        </div>

        {/* Footer — the shared ModalFooter (§4): disabled (not just clamped) whenever
            the current config would be unusable — e.g. an emptied interval
            (`+'' === 0`, BUG 3) or a webhook trigger with no agent chosen yet
            (BUG 4) — a hard backstop regardless of blur/focus state. */}
        <ModalFooter onCancel={onClose} onSubmit={form.handleSave}
          cancelLabel={t('scheduleModal.cancel')} submitLabel={t('scheduleModal.save')}
          disabled={!form.canSave} />
    </FloatingPanel>
  )
}
