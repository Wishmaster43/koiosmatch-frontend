import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LogCountToolbar from './LogCountToolbar'

// LogCountToolbar is the shared count-summary + export row for LogView and AuditLog.
describe('LogCountToolbar', () => {
  it('renders the loading label while loading', () => {
    render(<LogCountToolbar loading shown={0} total={0} onExport={() => {}} exportDisabled />)
    expect(screen.getByText('audit.loading')).toBeInTheDocument()
  })

  it('renders the count summary once loaded', () => {
    render(<LogCountToolbar loading={false} shown={5} total={20} onExport={() => {}} exportDisabled={false} />)
    expect(screen.getByText('audit.countSummary')).toBeInTheDocument()
  })

  it('disables the export button when exportDisabled is true', () => {
    render(<LogCountToolbar loading={false} shown={5} total={20} onExport={() => {}} exportDisabled />)
    expect(screen.getByText('audit.export').closest('button')).toBeDisabled()
  })

  it('fires onExport once on click when enabled', () => {
    const onExport = vi.fn()
    render(<LogCountToolbar loading={false} shown={5} total={20} onExport={onExport} exportDisabled={false} />)
    fireEvent.click(screen.getByText('audit.export').closest('button')!)
    expect(onExport).toHaveBeenCalledTimes(1)
  })
})
