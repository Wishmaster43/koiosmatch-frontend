import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CalloutBox from '@/components/ui/CalloutBox'
import { useNumberFormat } from '@/lib/formatters'
import { useViewportBelow } from '@/hooks/useViewportBelow'

// Layout constant (Danny 15-10, ONIX N-013): the staff app is desktop-only at launch.
export const DESKTOP_MIN_WIDTH = 1024
const DISMISS_KEY = 'km_min_width_dismissed'

// Reads the per-session dismiss flag; storage may be blocked, so failures mean "not dismissed".
function readDismissed(): boolean {
  try { return window.sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

// Slim notice shown below the desktop width instead of a broken layout; dismissable per session.
export default function MinWidthNotice() {
  const { t } = useTranslation('common')
  const { formatNumber } = useNumberFormat()
  const below = useViewportBelow(DESKTOP_MIN_WIDTH)
  const [dismissed, setDismissed] = useState(readDismissed)

  // Remember the dismissal for this session only (a viewer convenience, never app state).
  const dismiss = () => {
    setDismissed(true)
    try { window.sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* storage unavailable */ }
  }

  if (!below || dismissed) return null
  return (
    <div role="status" className="shrink-0 px-3 py-2">
      <CalloutBox variant="warning" live="off" onDismiss={dismiss} dismissLabel={t('minWidth.dismiss')}>
        {t('minWidth.notice', { width: formatNumber(DESKTOP_MIN_WIDTH) })}
      </CalloutBox>
    </div>
  )
}
