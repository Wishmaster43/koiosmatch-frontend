/**
 * TenantPickPage — full-screen wall shown to a super admin who has no valid
 * stored bureau (the API answers 400 tenant_required). Picking one persists it
 * and reloads; signing out is the only other way forward.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTenantSearch } from '@/hooks/useTenantSearch'
import SearchSelect from '@/components/ui/SearchSelect'
import AuthWallShell from '@/components/auth/AuthWallShell'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import { FormLabel } from '@/components/ui/typography'

interface Picked { value: string; label: string }

export default function TenantPickPage() {
  const { t } = useTranslation('auth')
  const auth = useAuth()
  const { options, onSearch, error } = useTenantSearch()
  // Keep the picked option so its label survives a new search.
  const [picked, setPicked] = useState<Picked | null>(null)
  const [busy, setBusy] = useState(false)
  // Defensive: the wall only renders this with a live auth context.
  if (!auth) return null
  const { setActiveTenant, logout } = auth

  // Persist the choice; the context hard-reloads, so busy only resets on failure.
  const proceed = async () => {
    if (!picked) return
    setBusy(true)
    try { await setActiveTenant({ id: picked.value, name: picked.label }) } finally { setBusy(false) }
  }

  return (
    <AuthWallShell icon={<Building2 size={22} style={{ color: 'var(--color-primary-text)' }} />}
      title={t('tenantPick.title')} description={t('tenantPick.desc')}
      signOutLabel={t('tenantPick.signOut')} onSignOut={() => void logout()}>
      {/* A failed search must never read as an empty list. */}
      {error && <div style={{ marginBottom: 12 }}><CalloutBox variant="danger">{t('tenantPick.loadFailed')}</CalloutBox></div>}

      <div style={{ marginBottom: 20 }}>
        <FormLabel style={{ display: 'block', marginBottom: 6 }}>{t('tenantPick.pickerLabel')}</FormLabel>
        <SearchSelect
          options={options}
          selected={picked ? [picked.value] : []}
          onToggle={v => setPicked(options.find(o => o.value === v) ?? { value: v, label: v })}
          onSearch={onSearch}
          closeOnToggle
          triggerLabel={picked ? picked.label : t('tenantPick.pickerPlaceholder')}
          triggerAriaLabel={t('tenantPick.pickerLabel')}
        />
      </div>

      <Button type="button" variant="soft" disabled={!picked || busy} onClick={() => void proceed()}
        style={{ width: '100%' }}>
        {busy ? t('tenantPick.busy') : t('tenantPick.continue')}
      </Button>
    </AuthWallShell>
  )
}
