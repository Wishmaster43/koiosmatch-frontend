/**
 * EntityImportCard · client-side refusal text (#81). A refused file speaks the shared
 * upload policy: a type refusal lists the allowed extensions, a size refusal names the limit.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import EntityImportCard from './EntityImportCard'
import { setUploadPolicy } from '@/lib/uploadPolicy'

type CardProps = React.ComponentProps<typeof EntityImportCard>
const wizard = (): CardProps['wizard'] => ({
  step: 'upload', file: null, preview: { status: 'idle' }, run: { status: 'idle' }, selectFile: vi.fn(),
} as unknown as CardProps['wizard'])

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o) as string

describe('EntityImportCard refusal text', () => {
  afterEach(() => { setUploadPolicy(null as never) })

  it('shows the policy type refusal with the allowed extensions for a pdf', () => {
    const w = wizard()
    const { container } = render(<EntityImportCard wizard={w} canView canImport entity="customers" intro="intro" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'x.pdf')] } })
    expect(screen.getByText(t('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).toBeInTheDocument()
    expect(w.selectFile).not.toHaveBeenCalled()
  })

  it('shows the size refusal (not the file-type text) for an oversize csv', () => {
    setUploadPolicy({ import: { extensions: ['csv', 'txt', 'xlsx'], max_bytes: 5 * 1024 * 1024 } } as never)
    const w = wizard()
    const { container } = render(<EntityImportCard wizard={w} canView canImport entity="customers" intro="intro" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const big = new File(['x'], 'a.csv')
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [big] } })
    expect(screen.getByText(t('common:upload.tooLargeMax', { max: '5' }))).toBeInTheDocument()
    expect(screen.queryByText(t('settings:import.wrongFileType'))).not.toBeInTheDocument()
    expect(w.selectFile).not.toHaveBeenCalled()
  })
})
