/**
 * LookupValueMark — LOOKUP-ONE-ELEMENT-1: the shared row-level colour mark.
 * Covers both faces (icon-tinted / colour-only fill), the popover's icon-pick
 * and colour-pick paths, and that the aria-label always carries the row's label.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileText, Folder } from 'lucide-react'
import i18n from '@/i18n'
import { COLOR_PRESETS } from '@/lib/colorPresets'
import LookupValueMark from './LookupValueMark'

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const icons = ['file', 'folder']
const resolve = (slug?: string | null) => (slug === 'folder' ? Folder : FileText)
// Design tokens (§4), never raw hex — these two just need to be two DIFFERENT
// values for the tests below; the row's real colour is tenant DATA either way.
const ROW_COLOR = 'var(--color-primary)'
const OTHER_ROW_COLOR = 'var(--color-success)'

describe('LookupValueMark — icon-tinted face', () => {
  it('renders the resolved icon tinted in the row colour, with the icon+colour aria-label', () => {
    render(<LookupValueMark color={ROW_COLOR} icon="file" icons={icons} resolve={resolve} label="Contract" withColor
      onPickColor={vi.fn()} onPickIcon={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Contract' }) })
    expect(trigger).toBeInTheDocument()
    // The icon renders INSIDE the one trigger — no separate swatch dot beside it.
    expect(trigger.querySelector('svg')).toBeInTheDocument()
    // The icon's ink is chipInk(ROW_COLOR) — var(--color-primary)'s own AA-safe
    // text twin, never the raw colour (herhaal-slotaudit 20-08, mirrors SoftChip).
    expect(trigger).toHaveStyle({ color: 'var(--color-primary-text)' })
  })

  it('opens the popover on trigger click and closes it on an outside mousedown', async () => {
    const user = userEvent.setup()
    render(<LookupValueMark color={ROW_COLOR} icon="file" icons={icons} resolve={resolve} label="Contract" withColor
      onPickColor={vi.fn()} onPickIcon={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Contract' }) }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // SETTINGS-INCON-B2 F1 (Opus review, 13-09): a lookup row commonly sits inside a
  // scrolling list/table — the popover used to render `position: absolute` inside
  // the row's own subtree and got clipped by that scroll container. It now
  // portals into document.body, so it lives OUTSIDE the render container
  // regardless of what overflow ancestor wraps the row.
  it('portals the popover into document.body, not inside the row\'s own subtree', async () => {
    const user = userEvent.setup()
    const { container } = render(<LookupValueMark color={ROW_COLOR} icon="file" icons={icons} resolve={resolve} label="Contract" withColor
      onPickColor={vi.fn()} onPickIcon={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Contract' }) }))
    const menu = screen.getByRole('menu')
    expect(container.contains(menu)).toBe(false)
    expect(document.body.contains(menu)).toBe(true)
  })

  it('picking an icon calls onPickIcon and closes the popover', async () => {
    const onPickIcon = vi.fn()
    const user = userEvent.setup()
    render(<LookupValueMark color={ROW_COLOR} icon="file" icons={icons} resolve={resolve} label="Contract" withColor
      onPickColor={vi.fn()} onPickIcon={onPickIcon} />)

    await user.click(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Contract' }) }))
    await user.click(screen.getByRole('menuitem', { name: `${st('documentTypes.icon')}: folder` }))

    expect(onPickIcon).toHaveBeenCalledWith('folder')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('picking a colour from the palette below the icon grid calls onPickColor', async () => {
    const onPickColor = vi.fn()
    const user = userEvent.setup()
    render(<LookupValueMark color={ROW_COLOR} icon="file" icons={icons} resolve={resolve} label="Contract" withColor
      onPickColor={onPickColor} onPickIcon={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Contract' }) }))
    // SETTINGS-INCON-B2 F1: the popover is now portalled into document.body (it
    // no longer lives inside the render container), so the query runs against
    // document.body directly instead of the RTL container. The palette swatches
    // carry no accessible name (mirrors ColorPickerPopup) — the colour section is
    // the popover's LAST direct child (icon grid renders first).
    const buttons = document.body.querySelectorAll('div[role="menu"] > div:last-child > button')
    expect(buttons.length).toBeGreaterThan(0)
    await user.click(buttons[0] as HTMLButtonElement)

    expect(onPickColor).toHaveBeenCalledWith(COLOR_PRESETS[0])
  })
})

describe('LookupValueMark — colour-only face (no icon vocabulary)', () => {
  it('renders a solid colour fill and the colour-only aria-label, no icon inside', () => {
    render(<LookupValueMark color={OTHER_ROW_COLOR} icon={null} icons={null} label="Starter" withColor
      onPickColor={vi.fn()} onPickIcon={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Starter' }) })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveStyle({ background: OTHER_ROW_COLOR })
    expect(trigger.querySelector('svg')).not.toBeInTheDocument()
  })

  it('falls back to the shared FALLBACK_SWATCH constant when the row has no colour stored (never undefined)', () => {
    render(<LookupValueMark color={null} icon={null} icons={null} label="Onbekend" withColor
      onPickColor={vi.fn()} onPickIcon={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Onbekend' }) })
    // FALLBACK_SWATCH (#6B7280) — jsdom normalises the inline hex to rgb().
    expect(trigger).toHaveStyle({ background: 'rgb(107, 114, 128)' })
  })
})
