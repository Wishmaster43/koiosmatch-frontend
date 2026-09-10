import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { appointmentsTabGate } from './appointmentsTabGate'

const t = ((key: string) => key) as unknown as TFunction

describe('appointmentsTabGate', () => {
  it('returns the no-permission notice first, before loading/error', () => {
    const el = appointmentsTabGate({ canView: false, loading: true, error: true, t })
    render(<>{el}</>)
    expect(screen.getByText('appointmentsTab.noPermission')).toBeInTheDocument()
  })

  it('returns the loading notice once canView is true', () => {
    const el = appointmentsTabGate({ canView: true, loading: true, error: false, t })
    render(<>{el}</>)
    expect(screen.getByText('page.loading')).toBeInTheDocument()
  })

  it('returns the error notice once loading has finished', () => {
    const el = appointmentsTabGate({ canView: true, loading: false, error: true, t })
    render(<>{el}</>)
    expect(screen.getByText('appointmentsTab.loadError')).toBeInTheDocument()
  })

  it('returns undefined once canView/loading/error all clear the gate', () => {
    const el = appointmentsTabGate({ canView: true, loading: false, error: false, t })
    expect(el).toBeUndefined()
  })
})
