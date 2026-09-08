import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageCircle } from 'lucide-react'
import MetadataBadge from './MetadataBadge'
import type { BadgeMeta } from './MetadataBadge'

describe('MetadataBadge', () => {
  const testMeta: Record<string, BadgeMeta> = {
    active: {
      bg: 'var(--color-success-bg)',
      color: 'var(--color-on-success-bg)',
      Icon: MessageCircle,
    },
    inactive: {
      bg: 'var(--color-warning-bg)',
      color: 'var(--color-warning-text)',
      Icon: MessageCircle,
    },
  }

  it('renders with matched meta and translated label', () => {
    const labelOf = (key: string | undefined) => (key ? `Status: ${key}` : '—')
    render(
      <MetadataBadge
        value="active"
        meta={testMeta}
        labelOf={labelOf}
        fallbackIcon={MessageCircle}
      />
    )
    expect(screen.getByText('Status: active')).toBeInTheDocument()
  })

  it('renders fallback for unrecognised value', () => {
    const labelOf = (key: string | undefined) => (key ? `Status: ${key}` : 'Unknown')
    render(
      <MetadataBadge
        value="unknown"
        meta={testMeta}
        labelOf={labelOf}
        fallbackIcon={MessageCircle}
      />
    )
    expect(screen.getByText('Status: unknown')).toBeInTheDocument()
  })

  it('renders em-dash for empty value', () => {
    const labelOf = (key: string | undefined) => (key ? `Status: ${key}` : '—')
    render(
      <MetadataBadge value={undefined} meta={testMeta} labelOf={labelOf} fallbackIcon={MessageCircle} />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders icon when icon exists', () => {
    const labelOf = (key: string | undefined) => (key ? `Status: ${key}` : '—')
    const { container } = render(
      <MetadataBadge
        value="active"
        meta={testMeta}
        labelOf={labelOf}
        fallbackIcon={MessageCircle}
      />
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
