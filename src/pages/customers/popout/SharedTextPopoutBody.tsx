/**
 * SharedTextPopoutBody — consolidates the identical rendering logic from
 * CustomerContactTextPopout and CustomerDepartmentTextPopout. Takes generic
 * load/save callbacks and renders the PopoutShell + TextPopoutEditor.
 */
import { ReactNode } from 'react'
import { PopoutShell } from '@/pages/popout/shared'
import { TextPopoutEditor } from '@/pages/popout/shared'
import type { GenerateEntity } from '@/components/ui/richtext/richTextAssistApi'

interface SharedTextPopoutBodyProps {
  loading: boolean
  error: boolean
  onRetry: () => void
  name: string
  subtitle: string
  text: string | null | undefined
  dirty: boolean
  onChange: (value: string) => void
  onSave: () => Promise<boolean>
  loadingLabel: string
  errorLabel: string
  retryLabel: string
  generate?: { entity: GenerateEntity; id: string }
  children?: ReactNode
}

// Render the shared popout shell + editor for a text field. Extracted from
// CustomerContactTextPopout and CustomerDepartmentTextPopout (0% behaviour change).
export default function SharedTextPopoutBody({
  loading, error, onRetry, name, subtitle, text, dirty, onChange, onSave,
  loadingLabel, errorLabel, retryLabel, generate, children,
}: SharedTextPopoutBodyProps) {
  return (
    <PopoutShell
      loading={loading} error={error || (!name && !loading)} onRetry={onRetry}
      loadingLabel={loadingLabel} errorLabel={errorLabel} retryLabel={retryLabel}
      name={name} initials="" subtitle={subtitle}
    >
      <TextPopoutEditor value={text ?? ''} onChange={onChange} onSave={onSave} dirty={dirty}
        generate={generate} />
      {children}
    </PopoutShell>
  )
}
