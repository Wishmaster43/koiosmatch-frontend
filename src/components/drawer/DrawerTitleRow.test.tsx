import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import DrawerTitleRow from './DrawerTitleRow'

describe('DrawerTitleRow', () => {
  it('renders the title, reference chip and subtitle with the default span title element', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <DrawerTitleRow title="Jane Doe" referenceNumber="K-123" subtitle="Recruiter" />
      </I18nextProvider>,
    )

    const title = screen.getByText('Jane Doe')
    expect(title.tagName).toBe('SPAN')
    expect(screen.getByText('K-123')).toBeInTheDocument()
    expect(screen.getByText('Recruiter')).toBeInTheDocument()
  })

  it('honours titleAs to switch the title element (customer drawer uses div)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <DrawerTitleRow title="Acme B.V." titleAs="div" subtitle="Amsterdam" />
      </I18nextProvider>,
    )

    const title = screen.getByText('Acme B.V.')
    expect(title.tagName).toBe('DIV')
  })

  it('hides the detached-count badge when the count is zero', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DrawerTitleRow title="Vacancy X" detachedCount={0} subtitle="Client Y" />
      </I18nextProvider>,
    )

    expect(container.querySelectorAll('span[title]')).toHaveLength(0)
  })
})
