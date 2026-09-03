/**
 * useTextPrompt — call-site sugar around the shared TextPromptDialog (§0 tech-debt
 * cleanup: replaces window.prompt()). `prompt(title, label, onSubmit, options)`
 * stages one pending text-input prompt; render the returned `dialog` element once
 * per component. Keeps every text-input call-site to a single line instead of
 * duplicating open/pending state across each file.
 */
import { useCallback, useState } from 'react'
import TextPromptDialog from '@/components/ui/TextPromptDialog'

interface PromptOptions {
  placeholder?: string
}

interface PromptState extends PromptOptions {
  title: string
  label: string
  onSubmit: (value: string) => void
}

/**
 * useTextPrompt — returns a `prompt(title, label, onSubmit, options)` function
 * and a `dialog` element to render. Calling prompt() stages one pending text prompt;
 * the user's input and button click drive the callback.
 */
export function useTextPrompt() {
  const [state, setState] = useState<PromptState | null>(null)
  const [inputValue, setInputValue] = useState('')

  // Stage a text prompt — the action only runs after the user submits.
  const prompt = useCallback((title: string, label: string, onSubmit: (value: string) => void, options?: PromptOptions) => {
    setState({ title, label, onSubmit, ...options })
    setInputValue('')
  }, [])

  const dialog = (
    <TextPromptDialog
      open={state != null}
      title={state?.title ?? ''}
      label={state?.label ?? ''}
      placeholder={state?.placeholder}
      value={inputValue}
      onValueChange={setInputValue}
      onConfirm={() => {
        const trimmed = inputValue.trim()
        if (trimmed) {
          state?.onSubmit(trimmed)
        }
        setState(null)
        setInputValue('')
      }}
      onCancel={() => {
        setState(null)
        setInputValue('')
      }}
    />
  )

  return { prompt, dialog }
}
