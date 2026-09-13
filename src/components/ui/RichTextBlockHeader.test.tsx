import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RichTextBlockHeader } from './RichTextBlockHeader'

const t = ((k: string) => k) as unknown as import('i18next').TFunction

describe('RichTextBlockHeader', () => {
  it('shows edit + popout actions when not editing, and calls the right handlers', () => {
    const onStartEdit = vi.fn()
    const onPopout = vi.fn()
    render(<RichTextBlockHeader t={t} title="Title" editing={false}
      onSave={vi.fn()} onCancel={vi.fn()} onStartEdit={onStartEdit} onPopout={onPopout} id="m1" />)
    fireEvent.click(screen.getByTitle('common:edit'))
    expect(onStartEdit).toHaveBeenCalled()
    fireEvent.click(screen.getByTitle('common:openSecondScreen'))
    expect(onPopout).toHaveBeenCalled()
  })

  it('hides the popout button when id is missing', () => {
    render(<RichTextBlockHeader t={t} title="Title" editing={false}
      onSave={vi.fn()} onCancel={vi.fn()} onStartEdit={vi.fn()} onPopout={vi.fn()} id={undefined} />)
    expect(screen.queryByTitle('common:openSecondScreen')).toBeNull()
  })

  it('shows save + cancel actions while editing', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<RichTextBlockHeader t={t} title="Title" editing
      onSave={onSave} onCancel={onCancel} onStartEdit={vi.fn()} />)
    fireEvent.click(screen.getByTitle('common:save'))
    expect(onSave).toHaveBeenCalled()
    fireEvent.click(screen.getByTitle('common:cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
