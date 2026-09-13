/** PlaceholderSettings — simple centered title/description placeholder for sections
 * that are not built out yet (billing, app store). */
import type { ReactNode } from 'react'
import { PageTitle } from '@/components/ui/typography'

interface PlaceholderSettingsProps {
  // The caller's own translated section title.
  title: ReactNode
  // The caller's own translated description below the title.
  description: ReactNode
}

// Renders the caller's own translated title/description; see the module doc comment above for when this is used.
export default function PlaceholderSettings({ title, description }: PlaceholderSettingsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 260, color: 'var(--text-muted)', gap: 8 }}>
      <PageTitle as="div">{title}</PageTitle>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  )
}
