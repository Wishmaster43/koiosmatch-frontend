/**
 * SmDrawerShell — reusable drawer panel shell for shiftmanager entities
 * (contacts, departments, locations). Provides the fixed outer frame: 380px
 * width, left border, header with title and close button, scrollable content.
 */
import React from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'

interface SmDrawerShellProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  headerExtras?: React.ReactNode
}

export default function SmDrawerShell({ title, onClose, children, headerExtras }: SmDrawerShellProps) {
  const { t } = useTranslation('common')
  return (
    <div
      style={{
        width: 380,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header with title and close button. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <PageTitle as="span">{title}</PageTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {headerExtras}
          <Button
            variant="ghost"
            iconOnly
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Scrollable content area. */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
    </div>
  )
}
