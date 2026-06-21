import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

/** Placeholder for a module tab that has no configurable settings yet. */
export default function ModulePlaceholder() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 20px', textAlign: 'center' }}>
      <Sparkles size={32} style={{ color: 'var(--text-muted)', opacity: 0.35, marginBottom: 12 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('modules.emptyTitle')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('modules.emptyDesc')}</div>
    </div>
  )
}
