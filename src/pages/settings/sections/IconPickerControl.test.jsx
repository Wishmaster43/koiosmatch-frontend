/**
 * IconPickerControl — outside-click-closes-popover regression for the
 * CLICK-OUTSIDE-2 adoption of the shared useClickOutside hook.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { FileText, Folder } from 'lucide-react'
import IconPickerControl from './IconPickerControl'

// Minimal i18n instance so t() resolves to stable keys for assertions.
i18n.use(initReactI18next).init({
  lng: 'en', resources: {}, interpolation: { escapeValue: false },
  returnNull: false, returnEmptyString: false,
})

const icons = ['file', 'folder']
const resolve = (slug) => (slug === 'folder' ? Folder : FileText)

function setup() {
  render(
    <I18nextProvider i18n={i18n}>
      <IconPickerControl icons={icons} resolve={resolve} value="file" color="var(--color-primary)" label="Contract" onPick={vi.fn()} />
    </I18nextProvider>
  )
}

describe('IconPickerControl popover', () => {
  it('opens on trigger click and closes on an outside mousedown', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'documentTypes.icon: Contract' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // SETTINGS-INCON-B2 F1 (Opus review, 13-09): the popover used to render
  // `position: absolute` inside its trigger's own subtree — clipped by a hosting
  // modal's `overflow: hidden`/`auto` panel. It now portals into document.body,
  // so it lives OUTSIDE the render container regardless of what overflow
  // ancestor wraps the trigger.
  it('portals the popover into document.body, not inside the trigger\'s own subtree', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <IconPickerControl icons={icons} resolve={resolve} value="file" color="var(--color-primary)" label="Contract" onPick={vi.fn()} />
      </I18nextProvider>
    )
    await user.click(screen.getByRole('button', { name: 'documentTypes.icon: Contract' }))
    const menu = screen.getByRole('menu')
    expect(container.contains(menu)).toBe(false)
    expect(document.body.contains(menu)).toBe(true)
  })
})
