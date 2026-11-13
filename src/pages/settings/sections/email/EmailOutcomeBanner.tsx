import { Check, AlertTriangle } from 'lucide-react'
import CalloutBox from '@/components/ui/CalloutBox'
import type { OutcomeBanner } from './types'

// Props: the outcome to show (test send or OAuth callback landing).
interface EmailOutcomeBannerProps {
  banner: OutcomeBanner
}

// A success/danger callout with an icon, used for the test-send result and the OAuth callback banner.
export default function EmailOutcomeBanner({ banner }: EmailOutcomeBannerProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <CalloutBox variant={banner.ok ? 'success' : 'danger'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {banner.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
          {banner.msg}
        </div>
      </CalloutBox>
    </div>
  )
}
