/**
 * SubscriptionUsersLine (TASK D) — line + extra + no-extra, real i18n instance.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import SubscriptionUsersLine from './SubscriptionUsersLine'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('SubscriptionUsersLine', () => {
  it('renders the users line', () => {
    render(<SubscriptionUsersLine users={{ included: 5, active: 5, extra: 0, extra_amount: 0 }} />)
    expect(screen.getByText(t('billing.usage.plan.users.line', { active: '5', included: '5' }))).toBeInTheDocument()
  })

  it('renders the extra line when extra>0', () => {
    render(<SubscriptionUsersLine users={{ included: 5, active: 7, extra: 2, extra_amount: 9.5 }} />)
    expect(screen.getByText(t('billing.usage.plan.users.line', { active: '7', included: '5' }))).toBeInTheDocument()
    expect(screen.getByText(/9,50/)).toBeInTheDocument()
  })

  it('renders no extra line when extra is 0', () => {
    render(<SubscriptionUsersLine users={{ included: 5, active: 5, extra: 0, extra_amount: 0 }} />)
    expect(screen.queryByText(t('billing.usage.plan.users.extra', { extra: '0', amount: '€ 0,00' }))).toBeNull()
  })

  it('renders nothing when users is absent', () => {
    const { container } = render(<SubscriptionUsersLine users={undefined} />)
    expect(container.firstChild).toBeNull()
  })
})
