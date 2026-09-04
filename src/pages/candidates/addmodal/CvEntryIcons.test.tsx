/**
 * CvEntryIcons — outside-click-closes-popover regression for the CLICK-OUTSIDE-2
 * adoption of the shared useClickOutside hook (was a hand-rolled mousedown effect).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import CvEntryIcons from './CvEntryIcons'

// Minimal i18n instance so t() resolves to stable keys for assertions.
i18n.use(initReactI18next).init({
  lng: 'en', resources: {}, interpolation: { escapeValue: false },
  returnNull: false, returnEmptyString: false,
})

function setup() {
  render(
    <I18nextProvider i18n={i18n}>
      <CvEntryIcons onFile={vi.fn()} onSubmitText={vi.fn()} />
    </I18nextProvider>
  )
}

describe('CvEntryIcons paste popover', () => {
  it('opens on trigger click and closes on an outside mousedown', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'modal.cvPaste.openButton' }))
    expect(screen.getByRole('textbox', { name: 'modal.cvPaste.title' })).toBeInTheDocument()

    act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(screen.queryByRole('textbox', { name: 'modal.cvPaste.title' })).not.toBeInTheDocument()
  })
})
