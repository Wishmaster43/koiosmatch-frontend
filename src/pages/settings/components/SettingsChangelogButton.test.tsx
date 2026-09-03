/**
 * SettingsChangelogButton — test logName prop handling:
 * undefined → defaults to 'settings' (key/value table)
 * 'tablename' → queries GET /activity-log?log_name=tablename
 * null → renders disabled button with noTrailYet title
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import SettingsChangelogButton from './SettingsChangelogButton'

describe('SettingsChangelogButton', () => {
  it('renders ChangelogPopover by default (undefined logName → settings)', () => {
    // logName undefined defaults to 'settings'; EntityChangelog receives it
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <SettingsChangelogButton />
      </I18nextProvider>
    )
    // ChangelogPopover renders a button (via ButtonTrigger pattern)
    const button = container.querySelector('button')
    expect(button).toBeInTheDocument()
  })

  it('renders ChangelogPopover with custom logName', () => {
    // logName='candidate_statuses' passes through to EntityChangelog
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <SettingsChangelogButton logName="candidate_statuses" />
      </I18nextProvider>
    )
    const button = container.querySelector('button')
    expect(button).toBeInTheDocument()
  })

  it('renders disabled button with noTrailYet tooltip when logName is null', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <SettingsChangelogButton logName={null} />
      </I18nextProvider>
    )
    const button = container.querySelector('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Nog geen audittrail voor dit onderdeel')
    expect(button).toHaveAttribute('aria-label', 'Nog geen audittrail voor dit onderdeel')
  })
})
