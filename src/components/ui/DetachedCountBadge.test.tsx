/**
 * DetachedCountBadge — ONTKOPPEL-TELLER-1: the shared warning chip every
 * drill-down (candidate/vacancy/customer) uses to show its currently-detached
 * count. Hidden at 0/undefined; renders the count when present.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import DetachedCountBadge from './DetachedCountBadge'

describe('DetachedCountBadge', () => {
  it('renders nothing when the count is 0', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}><DetachedCountBadge count={0} /></I18nextProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the count is undefined', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}><DetachedCountBadge /></I18nextProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the count when above zero, never inside a filtered block', () => {
    render(<I18nextProvider i18n={i18n}><DetachedCountBadge count={3} /></I18nextProvider>)
    expect(screen.getByText('3 ontkoppeld')).toBeInTheDocument()
  })
})
