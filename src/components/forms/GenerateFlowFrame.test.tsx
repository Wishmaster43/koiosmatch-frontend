/**
 * GenerateFlowFrame — asserts the idle entry button (label/disabled/title) and
 * the open region wrapper (header slot + children), shared by
 * ProfileGenerateFlow and GenerateDescriptionFlow.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GenerateFlowFrame from './GenerateFlowFrame'

describe('GenerateFlowFrame · idle', () => {
  it('renders the entry button, disabled with the given title when canGenerate is false', async () => {
    const onOpen = vi.fn()
    render(
      <GenerateFlowFrame open={false} onOpen={onOpen} canGenerate={false} label="Genereer" disabledTitle="Vul eerst een titel in"
        header={<div />}>
        <div />
      </GenerateFlowFrame>,
    )
    const btn = screen.getByRole('button', { name: 'Genereer' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Vul eerst een titel in')
    await userEvent.click(btn)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('enables the entry button and calls onOpen when canGenerate is true', async () => {
    const onOpen = vi.fn()
    render(
      <GenerateFlowFrame open={false} onOpen={onOpen} canGenerate label="Genereer" disabledTitle="Vul eerst een titel in"
        header={<div />}>
        <div />
      </GenerateFlowFrame>,
    )
    const btn = screen.getByRole('button', { name: 'Genereer' })
    expect(btn).not.toBeDisabled()
    await userEvent.click(btn)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('GenerateFlowFrame · open', () => {
  it('renders the region with the caller-supplied header and children', () => {
    render(
      <GenerateFlowFrame open onOpen={vi.fn()} canGenerate label="Genereer" disabledTitle="x"
        header={<div data-testid="header">HEADER</div>}>
        <div data-testid="body">BODY</div>
      </GenerateFlowFrame>,
    )
    const region = screen.getByRole('region', { name: 'Genereer' })
    expect(region).toContainElement(screen.getByTestId('header'))
    expect(region).toContainElement(screen.getByTestId('body'))
  })
})
