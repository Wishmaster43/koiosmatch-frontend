/**
 * useProfileForm — data layer for ProfilePage (§3): the profile form (synced from
 * /auth/me), saving it back, and the avatar upload/remove. Keeps the page a thin
 * presentational container.
 */
import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import type { ProfileFormData } from './profileParts'

export function useProfileForm() {
  const { t } = useTranslation('auth')
  const { user, refreshUser } = useAuth() ?? {}

  const [form,   setForm]   = useState<ProfileFormData>({ firstname: '', lastname: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Avatar upload — instant local preview, then persist (mirrors the logo upload).
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarBusy,    setAvatarBusy]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // Tracks the blob: URL created for the picked file, so it can be revoked when
  // replaced/cleared and on unmount — otherwise every avatar pick leaks memory
  // (mirrors EntityHeader's PhotoAvatar fix).
  const createdUrlRef = useRef<string | null>(null)

  // Revoke the last object URL we created on unmount (page navigated away mid-pick).
  useEffect(() => () => { if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current) }, [])

  // Sync as soon as the user arrives from /auth/me (may be after mount).
  useEffect(() => {
    if (!user) return
    setForm({
      firstname:        user.firstname        ?? '',
      lastname:         user.lastname         ?? '',
      email:            user.email            ?? '',
      phone:            user.phone            ?? '',
      default_per_page: user.default_per_page ?? 500,
    })
  }, [user?.id, user?.firstname, user?.lastname, user?.email, user?.phone, user?.default_per_page])

  // Build a change handler for a single text field.
  const set = (k: keyof ProfileFormData) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Persist profile fields, then refresh the cached user.
  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await api.put('/auth/me', form)
      await refreshUser?.()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError(t('profile.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const photo = avatarPreview ?? user?.avatar_url ?? null

  // Upload a new avatar — optimistic preview, persist, then refresh on success.
  const onPickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke the previous preview (if any) before creating+tracking the new one.
    if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current)
    const url = URL.createObjectURL(file)
    createdUrlRef.current = url
    setAvatarPreview(url)   // show immediately
    setAvatarBusy(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await api.post('/auth/me/avatar', fd)
      if (res.data?.avatar_url) {
        // The server copy replaces the local preview — the blob URL is no longer needed.
        URL.revokeObjectURL(url); createdUrlRef.current = null
        setAvatarPreview(null); await refreshUser?.()
      }
    } catch { /* backend may not exist yet — keep the local preview */ }
    finally { setAvatarBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // Remove the stored avatar and fall back to initials.
  const removeAvatar = async () => {
    setAvatarBusy(true)
    try { await api.delete('/auth/me/avatar'); await refreshUser?.() } catch { /* noop */ }
    if (createdUrlRef.current) { URL.revokeObjectURL(createdUrlRef.current); createdUrlRef.current = null }
    setAvatarPreview(null); setAvatarBusy(false)
  }

  const initials = [form.firstname, form.lastname]
    .filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'

  return { user, form, setForm, set, saving, saved, error, handleSave,
           photo, avatarBusy, fileRef, onPickAvatar, removeAvatar, initials }
}
