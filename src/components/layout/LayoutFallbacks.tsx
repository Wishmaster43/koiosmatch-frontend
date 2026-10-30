/** Fallback screens of the app shell: lazy-chunk loader and the no-access page. */
import { useTranslation } from 'react-i18next'

// Fallback while a lazily-loaded page chunk is being fetched.
export function PageLoader() {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-(--text-muted) animate-pulse">{t('loading')}</p>
    </div>
  )
}

// Shown when a user opens a page they are not allowed to access.
export function NoAccessPage() {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('noAccess')}</p>
        <p className="mt-1 text-xs text-(--text-muted)">{t('noAccessDesc')}</p>
      </div>
    </div>
  )
}
