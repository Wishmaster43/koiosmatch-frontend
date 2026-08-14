/**
 * LocationLogoAvatar — K4BLOGO: a location's own logo, uploaded straight to the
 * REAL backend route (POST /customers/{customerId}/locations/{id}/logo,
 * multipart) and rendered from the signed URL the response returns. Deliberately
 * NOT built on the shared EntityHeader/PhotoAvatar menu (CustomerDrawer's own
 * "onPhotoChange") — that control only ever hands the caller a local `blob:`
 * object URL, never the File itself, so it cannot drive a real upload; it is a
 * preview-only affordance with no persistence path anywhere in this codebase.
 * Wiring a second entity to that same non-working pattern would just be a second
 * fake affordance (§3), so this is a small standalone control instead: a real
 * `<input type="file">`, a real multipart POST, and a real error path — the
 * server has no delete/clear route for this field, so there is no "remove"
 * menu item to fake either (upload replaces; that is the one working action).
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Loader2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { notifyError } from '@/lib/notify'
import { uploadLocationLogo, LOCATIONS_CHANGED_EVENT } from '../hooks/useCustomerLocations'
import type { Id } from '@/types/common'

interface Props {
  customerId: Id | undefined
  locationId: Id
  logoUrl: string | null
  name: string
  /** customers.update — hides the upload affordance entirely for a viewer without it. */
  canUpdate: boolean
}

export default function LocationLogoAvatar({ customerId, locationId, logoUrl, name, canUpdate }: Props) {
  const { t } = useTranslation('customers')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const initials = (name || '').trim().slice(0, 2).toUpperCase()

  // Viewer without customers.update — plain read-only avatar, no upload affordance.
  if (!canUpdate) return <Avatar initials={initials} size={40} photo={logoUrl} soft />

  // Upload replaces whatever logo existed; the response's signed URL is applied
  // via the shared LOCATIONS_CHANGED_EVENT refetch (mirrors archive/restore) —
  // this component holds no local copy of the row, so it never goes stale.
  const pick = async (file: File) => {
    if (!customerId) return
    setUploading(true)
    try {
      await uploadLocationLogo(customerId, locationId, file)
      window.dispatchEvent(new CustomEvent(LOCATIONS_CHANGED_EVENT))
    } catch {
      notifyError(t('locations.detail.logoUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
        aria-label={t('locations.detail.logoUpload')} title={t('locations.detail.logoUpload')}
        style={{ background: 'none', border: 'none', cursor: uploading ? 'default' : 'pointer', padding: 0, display: 'block', position: 'relative', borderRadius: '50%' }}>
        <Avatar initials={initials} size={40} photo={logoUrl} soft />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uploading ? 1 : 0, transition: 'opacity 0.15s' }}
          onMouseEnter={e => { if (!uploading) e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { if (!uploading) e.currentTarget.style.opacity = '0' }}>
          {uploading ? <Loader2 size={13} color="white" className="animate-spin" /> : <Camera size={13} color="white" />}
        </div>
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label={t('locations.detail.logoUpload')}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
    </div>
  )
}
