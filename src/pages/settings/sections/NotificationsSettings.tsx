import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
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
interface NotificationsSettingsProps {
  // The notification context this tab manages (Notifier::TYPE_CONTEXT_MAP key).
  context: string
}

export default function NotificationsSettings({ context }: NotificationsSettingsProps) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  const inAppKey = `notif_${context}_in_app`
  const emailKey = `notif_${context}_email`
  const popupKey = `notif_${context}_popup`
  // NOTIF-PARITY-1: shared with MyNotificationsSettings so both screens agree on
  // which contexts have no working backend emitter yet (see lib/notificationContexts).
  const noEmitterYet = hasNoEmitterYet(context)

  // O-27 (verified against api app/Support/Notifier.php, commit 551c17e1): in-app defaults
  // ON (absent = on, unchanged), e-mail is OPT-IN and defaults OFF (absent = off) — the FE
  // default mirrors the backend gate exactly so an unsaved screen never misrepresents the
  // live state before the first load resolves.
  // Popup defaults ON like in-app (absent = on, same passthrough, NOTIF-POPUP-1).
  const defaults = useMemo(
    () => ({ [inAppKey]: true, [emailKey]: false, [popupKey]: true }),
    [inAppKey, emailKey, popupKey],
  )
  const form = useSettingsForm(defaults)

  // When user lacks permissions, hide Save.
  const gatedForm = canEdit ? form : { ...form, save: undefined }

  // ONE block, TWO named toggles (Danny 13-08 "1 blok met 2 toggles"): the two
  // channels of this one notification type live in a single SettingRow — the
  // channel name sits directly beside its own switch, so "app of e-mail" reads
  // as one decision, not two separate cards. No "mail provider configured" gate
  // exists to key the e-mail copy off (GenericNotification::toMail uses the
  // app-default mailer) — the copy makes no claim about provider state.
  const channels = [
    { key: inAppKey, label: t('notifications.inApp.label') },
    { key: emailKey, label: t('notifications.email.label') },
    { key: popupKey, label: t('notifications.popup.label') },
  ]

  return (
    <SettingsScaffold
      title={t(`notifications.context.${context}.title`, context)}
      subtitle={t(`notifications.context.${context}.desc`, '')}
      maxWidth={960} form={gatedForm}>
      <SettingRow label={t('notifications.channels.label')} description={t('notifications.channels.desc')}>
        {/* Honest gate (NOTIF-PARITY-1): a context with no real emitter never promises
            delivery it cannot make, on any of the three channels — a calm muted marker replaces
            the working-toggle look, and both switches are disabled-with-reason. */}
        {noEmitterYet && (
          <SoftChip label={t('notifications.inApp.notYetActive')} color="var(--text-muted)"
            title={t('notifications.inApp.notYetActiveReason')} />
        )}
        {/* Danny 07-09: the channel name sits ABOVE its switch, blocks side by side with air between them. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          {channels.map(ch => (
            <label key={ch.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, cursor: (noEmitterYet || !canEdit) ? 'default' : 'pointer' }}>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{ch.label}</span>
              <Toggle checked={!!form.values[ch.key]} onChange={(v: boolean) => form.set(ch.key, v)}
                disabled={noEmitterYet || !canEdit} ariaLabel={ch.label}
                title={noEmitterYet ? t('notifications.inApp.notYetActiveReason') : undefined} />
            </label>
          ))}
        </div>
      </SettingRow>
    </SettingsScaffold>
  )
}
