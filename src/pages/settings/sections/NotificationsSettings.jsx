import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingRow, Toggle } from '../components/SettingsKit'
import SoftChip from '@/components/ui/SoftChip'
import { hasNoEmitterYet } from '../lib/notificationContexts'

/** NotificationsSettings — per-context (applications / vacancies / billing / candidates /
 * matches / tasks — mirrors api Notifier::TYPE_CONTEXT_MAP) notification preferences,
 * stored as `notif_<context>_in_app` + `notif_<context>_email` (O-27, commit 551c17e1).
 * Both channel keys live in the SAME generic tenant key/value settings store, so the
 * e-mail toggle needed no new backend route — it POSTs through the exact same `/settings`
 * endpoint the in-app toggle already used. Migrated to the settings kit; the scaffold owns
 * the header + dirty-aware save. */
export default function NotificationsSettings({ context }) {
  const { t } = useTranslation('settings')
  const inAppKey = `notif_${context}_in_app`
  const emailKey = `notif_${context}_email`
  // NOTIF-PARITY-1: shared with MyNotificationsSettings so both screens agree on
  // which contexts have no working backend emitter yet (see lib/notificationContexts).
  const noEmitterYet = hasNoEmitterYet(context)

  // O-27 (verified against api app/Support/Notifier.php, commit 551c17e1): in-app defaults
  // ON (absent = on, unchanged), e-mail is OPT-IN and defaults OFF (absent = off) — the FE
  // default mirrors the backend gate exactly so an unsaved screen never misrepresents the
  // live state before the first load resolves.
  const defaults = useMemo(() => ({ [inAppKey]: true, [emailKey]: false }), [inAppKey, emailKey])
  const form = useSettingsForm(defaults)

  // ONE block, TWO named toggles (Danny 13-08 "1 blok met 2 toggles"): the two
  // channels of this one notification type live in a single SettingRow — the
  // channel name sits directly beside its own switch, so "app of e-mail" reads
  // as one decision, not two separate cards. No "mail provider configured" gate
  // exists to key the e-mail copy off (GenericNotification::toMail uses the
  // app-default mailer) — the copy makes no claim about provider state.
  const channels = [
    { key: inAppKey, label: t('notifications.inApp.label') },
    { key: emailKey, label: t('notifications.email.label') },
  ]

  return (
    <SettingsScaffold
      title={t(`notifications.context.${context}.title`, context)}
      subtitle={t(`notifications.context.${context}.desc`, '')}
      maxWidth={640} form={form}>
      <SettingRow label={t('notifications.channels.label')} description={t('notifications.channels.desc')}>
        {/* Honest gate (NOTIF-PARITY-1): a context with no real emitter never promises
            delivery it cannot make, on either channel — a calm muted marker replaces
            the working-toggle look, and both switches are disabled-with-reason. */}
        {noEmitterYet && (
          <SoftChip label={t('notifications.inApp.notYetActive')} color="var(--text-muted)"
            title={t('notifications.inApp.notYetActiveReason')} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {channels.map(ch => (
            <label key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: noEmitterYet ? 'default' : 'pointer' }}>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{ch.label}</span>
              <Toggle checked={!!form.values[ch.key]} onChange={v => form.set(ch.key, v)}
                disabled={noEmitterYet} ariaLabel={ch.label}
                title={noEmitterYet ? t('notifications.inApp.notYetActiveReason') : undefined} />
            </label>
          ))}
        </div>
      </SettingRow>
    </SettingsScaffold>
  )
}
