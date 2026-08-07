/**
 * NoStatusNotice — the empty-state placeholder shown while no phase (Lead/
 * Kandidaat) is picked yet in ModalHeader's pill row. Pure presentational, no
 * props: fully self-contained, mirrors ModalHeader's own `useTranslation` call.
 */
import { useTranslation } from 'react-i18next'
import { UserPlus } from 'lucide-react'

export default function NoStatusNotice() {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--hover-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <UserPlus size={22} color="var(--text-muted)" />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{t('modal.noTypeSelected')}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{t('modal.chooseType')}</div>
      </div>
    </div>
  )
}
