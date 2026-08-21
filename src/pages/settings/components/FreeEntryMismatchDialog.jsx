/**
 * FreeEntryMismatchDialog — the §3B preflight for switching a lookup to STRICT
 * (settings-ronde 21-08 punt 1): the backend refuses `allow_free_entry: false`
 * with a 409 + `mismatches` while live records still carry values that are not
 * in the list. The old behaviour surfaced that as a vanishing toast, so the
 * toggle just looked broken; this dialog SHOWS the non-conforming values so the
 * user can fix them — never silently drop data, never a silent flip-back.
 * One shared dialog for functions · application sources · contact functions.
 */
/* eslint-disable react-refresh/only-export-components -- the dialog and its error-reader ship together by design; HMR-nicety warning only (house precedent: runFormat.tsx) */
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Caption, Mono } from '@/components/ui/typography'

// Read the 409 preflight payload off an axios error; null when it is not one.
export function mismatchesFromError(e) {
  const resp = e?.response
  if (resp?.status !== 409 || !Array.isArray(resp.data?.mismatches)) return null
  return resp.data.mismatches
}

export default function FreeEntryMismatchDialog({ mismatches, onClose }) {
  const { t } = useTranslation('settings')
  if (!mismatches) return null
  return (
    <ConfirmDialog open title={t('freeEntry.blockedTitle')} message={t('freeEntry.blockedIntro')}
      confirmLabel={t('freeEntry.blockedClose')} hideCancel onConfirm={onClose} onCancel={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {mismatches.map((m, i) => (
          <div key={m.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name ?? m.entity ?? '—'}
            </span>
            <Mono style={{ fontSize: 12 }}>{m.function ?? m.value ?? '—'}</Mono>
            {m.count > 1 && <Caption>×{m.count}</Caption>}
          </div>
        ))}
      </div>
      <Caption as="div">{t('freeEntry.blockedHint')}</Caption>
    </ConfirmDialog>
  )
}
