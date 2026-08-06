/** NotificationsSettings — per-context (applications / vacancies / billing / candidates /
 * matches / tasks — mirrors api Notifier::TYPE_CONTEXT_MAP) in-app notification preference,
 * stored as `notif_<context>_in_app`. Migrated to the settings kit; the scaffold owns the
 * header + dirty-aware save. */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCardList, SettingRow, Toggle } from '../components/SettingsKit'

export default function NotificationsSettings({ context }) {
  const { t } = useTranslation('settings')
  const inAppKey = `notif_${context}_in_app`

  const defaults = useMemo(() => ({ [inAppKey]: true }), [inAppKey])
  const form = useSettingsForm(defaults)

  // Email column HIDDEN, not disabled (verified 06-08 against api Notifier.php + the
  // settings-messaging routes): the gate only ever reads `notif_<context>_in_app` — there
  // is no `mail_capability`/`email.status` signal anywhere the FE could key off, and the
  // per-context EmailSettingsController is transactional outbound mail (candidates/
  // customers/planning), unrelated to this in-app Notifier gate. No signal to render an
  // honest ON/OFF state for, so the row does not render at all until a real mail channel
  // (and a capability flag) exists — a disabled toggle still promised a feature that has
  // no backend concept behind it.
  const options = [
    { key: inAppKey, label: t('notifications.inApp.label'), desc: t('notifications.inApp.desc') },
  ]

  return (
    <SettingsScaffold
      title={t(`notifications.context.${context}.title`, context)}
      subtitle={t(`notifications.context.${context}.desc`, '')}
      maxWidth={560} form={form}>
      <SettingCardList>
        {options.map(opt => (
          <SettingRow key={opt.key} label={opt.label} description={opt.desc}>
            <Toggle checked={!!form.values[opt.key]} onChange={v => form.set(opt.key, v)} />
          </SettingRow>
        ))}
      </SettingCardList>
    </SettingsScaffold>
  )
}
