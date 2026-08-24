/**
 * notificationSound — a short, soft two-tone chime for new-notification
 * attention toasts, synthesised via the Web Audio API (no asset file). Wrapped
 * in try/catch: browser autoplay policies can throw or silently reject before
 * a user gesture, and that must never break the toast/notification flow.
 */
const TONE_MS = 150
const GAIN = 0.05

// Play a soft two-tone chime (two short oscillator blips). Fire-and-forget.
export function playNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const playTone = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(GAIN, startAt)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + TONE_MS / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startAt)
      osc.stop(startAt + TONE_MS / 1000)
    }
    const now = ctx.currentTime
    playTone(660, now)
    playTone(880, now + TONE_MS / 1000)
    // Release the context shortly after the second tone finishes.
    setTimeout(() => { ctx.close().catch(() => {}) }, TONE_MS * 2 + 50)
  } catch {
    // Autoplay policy or missing Web Audio support — never break the caller.
  }
}
