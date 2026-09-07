/**
 * WorkflowEndpointsCard — editable webhook_send step endpoint URLs.
 * Stored as tenant settings webhook_endpoint_<slug>; allows mapping arbitrary
 * slugs to SSRF-guarded URLs. Uses shared EndpointRowGrid for consistent styling.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X as XIcon } from 'lucide-react'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import SectionCard from '@/components/ui/SectionCard'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import Button from '@/components/ui/Button'
import { Caption, Mono } from '@/components/ui/typography'
import { extractApiError } from '@/lib/extractApiError'
import { EndpointRowGrid } from '@/pages/settings/shared/EndpointRow'
import { endpointInputStyle } from '@/pages/settings/shared/endpointStyles'

// Parses all webhook_endpoint_* settings and returns them as slug→url pairs.
function parseEndpoints(settings: Record<string, unknown>): Array<{ slug: string; url: string }> {
  const result: Array<{ slug: string; url: string }> = []
  for (const [key, value] of Object.entries(settings)) {
    if (key.startsWith('webhook_endpoint_')) {
      const slug = key.replace('webhook_endpoint_', '')
      if (slug && typeof value === 'string') {
        result.push({ slug, url: value })
      }
    }
  }
  return result
}

// Validates slug format: lowercase a-z0-9_- only.
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9_-]+$/.test(slug)
}

interface EndpointRowProps {
  slug: string
  url: string
  onUrlChange: (newUrl: string) => void
  onRemove: () => void
  error?: string
  isSaving?: boolean
}

// Display row: slug (readonly), URL input, remove button.
function EndpointRow({ slug, url, onUrlChange, onRemove, error, isSaving }: EndpointRowProps) {
  const { t } = useTranslation('settings')
  const [localUrl, setLocalUrl] = useState(url)

  const handleBlur = () => {
    if (localUrl !== url) onUrlChange(localUrl)
  }

  return (
    <EndpointRowGrid
      slugCol={<Mono style={{ wordBreak: 'break-all' }}>{slug}</Mono>}
      urlCol={
        <input
          type="text"
          value={localUrl}
          onChange={(e) => setLocalUrl(e.target.value)}
          onBlur={handleBlur}
          disabled={isSaving}
          placeholder={t('webhooks.endpoints.urlPlaceholder')}
          style={endpointInputStyle(!!error, isSaving)}
        />
      }
      actionCol={
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={isSaving}
          title={t('webhooks.endpoints.remove')}
          aria-label={t('webhooks.endpoints.remove')}
          iconOnly
        >
          <XIcon size={16} />
        </Button>
      }
      error={error}
    />
  )
}

// New row being added: slug input + URL input, both editable.
interface NewEndpointRowProps {
  onSave: (slug: string, url: string) => void
  onCancel: () => void
  error?: string
  isSaving?: boolean
}

function NewEndpointRow({ onSave, onCancel, error, isSaving }: NewEndpointRowProps) {
  const { t } = useTranslation('settings')
  const [slug, setSlug] = useState('')
  const [url, setUrl] = useState('')
  const [slugError, setSlugError] = useState('')

  const handleSave = () => {
    if (!slug.trim()) return
    if (!isValidSlug(slug)) {
      setSlugError(t('webhooks.endpoints.invalidSlug'))
      return
    }
    onSave(slug, url)
  }

  const handleSlugChange = (val: string) => {
    setSlug(val)
    setSlugError('')
  }

  const handleUrlBlur = () => {
    handleSave()
  }

  return (
    <EndpointRowGrid
      slugCol={
        <input
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          disabled={isSaving}
          placeholder={t('webhooks.endpoints.slugPlaceholder')}
          style={endpointInputStyle(!!slugError, isSaving)}
        />
      }
      urlCol={
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
          disabled={isSaving}
          placeholder={t('webhooks.endpoints.urlPlaceholder')}
          style={endpointInputStyle(!!error, isSaving)}
        />
      }
      actionCol={
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          title={t('common:cancel')}
          aria-label={t('common:cancel')}
          iconOnly
        >
          <XIcon size={16} />
        </Button>
      }
      error={slugError || error}
    />
  )
}

// Main card component.
export default function WorkflowEndpointsCard() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const [isAdding, setIsAdding] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())

  const endpoints = parseEndpoints(settings)

  // Extract the new endpoint slug from the errors if one exists (for displaying errors on the new form).
  const newEndpointError = Object.entries(errors).find(([k]) => k.startsWith('_new_'))?.[1]

  const handleUrlChange = async (slug: string, newUrl: string) => {
    setSaving((s) => new Set([...s, slug]))
    try {
      await saveSettingsKeys({ [`webhook_endpoint_${slug}`]: newUrl })
      setErrors((e) => {
        const next = { ...e }
        delete next[slug]
        return next
      })
    } catch (err) {
      const msg = extractApiError(err, t('common:actionFailed'))
      setErrors((e) => ({ ...e, [slug]: msg }))
    } finally {
      setSaving((s) => {
        const next = new Set(s)
        next.delete(slug)
        return next
      })
    }
  }

  const handleRemove = async (slug: string) => {
    setSaving((s) => new Set([...s, slug]))
    try {
      // Save empty string to delete the setting.
      await saveSettingsKeys({ [`webhook_endpoint_${slug}`]: '' })
      setErrors((e) => {
        const next = { ...e }
        delete next[slug]
        return next
      })
    } catch (err) {
      const msg = extractApiError(err, t('common:actionFailed'))
      setErrors((e) => ({ ...e, [slug]: msg }))
    } finally {
      setSaving((s) => {
        const next = new Set(s)
        next.delete(slug)
        return next
      })
    }
  }

  const handleAddSave = async (slug: string, url: string) => {
    setSaving((s) => new Set([...s, `_new_${slug}`]))
    try {
      await saveSettingsKeys({ [`webhook_endpoint_${slug}`]: url })
      setErrors((e) => {
        const next = { ...e }
        delete next[`_new_${slug}`]
        return next
      })
      setIsAdding(false)
    } catch (err) {
      const msg = extractApiError(err, t('common:actionFailed'))
      setErrors((e) => ({ ...e, [`_new_${slug}`]: msg }))
    } finally {
      setSaving((s) => {
        const next = new Set(s)
        next.delete(`_new_${slug}`)
        return next
      })
    }
  }

  return (
    <SectionCard title={t('webhooks.endpoints.title')}>
      <Caption style={{ marginBottom: 12 }}>
        {t('webhooks.endpoints.hint')}
      </Caption>

      {/* Existing endpoints */}
      {endpoints.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {endpoints.map((ep) => (
            <EndpointRow
              key={ep.slug}
              slug={ep.slug}
              url={ep.url}
              onUrlChange={(newUrl) => handleUrlChange(ep.slug, newUrl)}
              onRemove={() => handleRemove(ep.slug)}
              error={errors[ep.slug]}
              isSaving={saving.has(ep.slug)}
            />
          ))}
        </div>
      )}

      {/* New endpoint form (shown when adding) */}
      {isAdding && (
        <NewEndpointRow
          onSave={handleAddSave}
          onCancel={() => setIsAdding(false)}
          error={newEndpointError}
          isSaving={saving.size > 0}
        />
      )}

      {/* + endpoint button */}
      {!isAdding && (
        <div style={{ marginTop: 12 }}>
          <DrawerAddButton onClick={() => setIsAdding(true)} label={t('webhooks.endpoints.add')} />
        </div>
      )}
    </SectionCard>
  )
}
