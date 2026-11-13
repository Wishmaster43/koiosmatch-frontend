import { useTranslation } from 'react-i18next'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Caption, SectionTitle } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { cardStyle } from './emailStyles'
import type { EmailConnStatus } from './types'

// Props: provider choice plus the real OAuth coupling state and its connect/disconnect actions.
interface EmailProviderCardProps {
  provider: string
  onProviderChange: (value: string) => void
  connLoading: boolean
  connStatus: EmailConnStatus | null
  statusSentence: string
  canEditConn: boolean
  connecting: boolean
  disconnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
}

// Provider picker (Gmail / Office 365 / manual SMTP) with the OAuth coupling callout.
export default function EmailProviderCard({
  provider, onProviderChange, connLoading, connStatus, statusSentence, canEditConn,
  connecting, disconnecting, onConnect: connectOauth, onDisconnect: disconnectOauth,
}: EmailProviderCardProps) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const PROVIDERS = [
    { id: 'gmail',  label: 'Gmail',                 desc: t('email.gmailDesc') },
    { id: 'office', label: 'Office 365',            desc: t('email.officeDesc') },
    { id: 'manual', label: t('email.manualLabel'),  desc: t('email.manualDesc') },
  ]
  return (
  <div style={cardStyle}>
    <SectionTitle as="div" style={{ marginBottom: 10 }}>{t('email.provider')}</SectionTitle>
    {/* Provider choice — shared SegmentedControl option-card radiogroup, one group
        for the three providers. SETTINGS-INCON-B1b: the chosen provider reads as
        chosen via the §4 "aan/gelukt" success pair, same green as the super-admin
        package picker. */}
    <SegmentedControl
      ariaLabel={t('email.provider')}
      color="var(--color-success)"
      activeOnly
      activeFill="var(--color-success-bg)"
      options={PROVIDERS.map(p => ({ value: p.id, label: p.label, description: p.desc }))}
      value={provider}
      onChange={onProviderChange}
    />

    {/* DL-10: real coupling state + connect/disconnect — the old copy claimed
        this "must be configured via the backend", which was false: the whole
        OAuth flow already exists and works, the FE simply never called it. */}
    {(provider === 'gmail' || provider === 'office') && (
      <div style={{ marginTop: 14 }}>
        {connLoading ? (
          <Caption>{t('common.loading')}</Caption>
        ) : connStatus?.connected && (!connStatus.status || connStatus.status === 'connected') ? (
          <CalloutBox variant="success" title={t('email.oauthConnectedTitle')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{t('email.oauthConnected', { provider: connStatus.provider === 'gmail' ? 'Google' : 'Microsoft', address: connStatus.address || '—' })}</span>
              <Button variant="dangerSoft" size="sm" onClick={disconnectOauth} disabled={disconnecting || !canEditConn}>
                {disconnecting ? <Spinner size={12} /> : t('email.oauthDisconnect')}
              </Button>
            </div>
          </CalloutBox>
        ) : connStatus?.status === 'tenant_policy' || connStatus?.status === 'needs_reconnect' ? (
          <CalloutBox variant="warning" title={t('email.oauthWarningTitle')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                {statusSentence}
                {connStatus.status_at && <Caption as="div">{t('email.statusAt', { date: formatDateTime(connStatus.status_at) })}</Caption>}
              </div>
              <Button variant="secondary" size="sm" onClick={connectOauth} disabled={connecting || !canEditConn}>
                {connecting ? <Spinner size={12} /> : t('email.oauthConnect')}
              </Button>
            </div>
          </CalloutBox>
        ) : (
          <CalloutBox variant="warning" title={t('email.oauthWarningTitle')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{t('email.oauthWarning', { provider: provider === 'gmail' ? 'Google' : 'Microsoft' })}</span>
              <Button variant="secondary" size="sm" onClick={connectOauth} disabled={connecting || !canEditConn}>
                {connecting ? <Spinner size={12} /> : t('email.oauthConnect')}
              </Button>
            </div>
          </CalloutBox>
        )}
      </div>
    )}
  </div>
  )
}
