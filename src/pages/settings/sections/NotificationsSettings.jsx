/** NotificationsSettings — per-context (applications / vacancies / billing) email +
 * in-app notification preferences, stored as `notif_<context>_<channel>`.
 * Migrated to the settings kit; the scaffold owns the header + dirty-aware save. */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCardList, SettingRow, Toggle } from '../components/SettingsKit'

export default function NotificationsSettings({ context }) {
  const { t } = useTranslation('settings')
  const emailKey = `notif_${context}_email`
  const inAppKey = `notif_${context}_in_app`

  const defaults = useMemo(() => ({ [emailKey]: true, [inAppKey]: true }), [emailKey, inAppKey])
  const form = useSettingsForm(defaults)

  const options = [
    { key: emailKey, label: t('notifications.email.label'), desc: t('notifications.email.desc') },
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
