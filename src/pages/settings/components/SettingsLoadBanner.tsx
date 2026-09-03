/**
 * SettingsLoadBanner — SETTINGS-LOAD-ERROR-1: the shared banner+retry for the
 * screens gated on useAllSettings()/useSettingsLoaded() directly — a group
 * distinct from SettingsScaffold's own `loadError` prop (SettingsKit.jsx), which
 * already renders a load-failure state for the `useSettingsForm` screens. These
 * 10+ screens only used `loaded` to disable controls, so a failed GET /settings
 * left them silently inert forever with no visible error and no way to retry.
 * Renders nothing while loaded; on 'loading' it renders the optional `loadingFallback`;
 * on 'failed' it shows the house ErrorBanner with a retry that re-issues the shared fetch.
 */
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { useSettingsLoadState } from '@/lib/settings/useAllSettings'

interface SettingsLoadBannerProps {
  loadingFallback?: ReactNode
}

export default function SettingsLoadBanner({ loadingFallback }: SettingsLoadBannerProps) {
  const { t } = useTranslation('settings')
  const { state, retry } = useSettingsLoadState()

  // While loading, render the optional loadingFallback if provided
  if (state === 'loading') return loadingFallback ?? null

  // On failed load, show the error banner with retry
  if (state === 'failed') {
    return (
      <ErrorBanner onRetry={retry} style={{ marginBottom: 12 }}>
        {t('common.loadError')}
      </ErrorBanner>
    )
  }

  // When loaded, render nothing
  return null
}
