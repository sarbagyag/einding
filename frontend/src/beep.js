// Generates a short two-note chime with the Web Audio API instead of bundling
// an audio file, so pomodoro completion has zero external/network dependency.
//
// Browsers only allow audio from a context created/resumed during a user
// gesture, so unlockAudio() must be called from a click handler (Start) —
// otherwise the completion beep minutes later would be silently blocked.

let ctx = null

function getContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!ctx) ctx = new Ctx()
  return ctx
}

export function unlockAudio() {
  const c = getContext()
  if (c && c.state === 'suspended') c.resume()
}

export function playBeep() {
  const c = getContext()
  if (!c) return
  if (c.state === 'suspended') c.resume()

  const note = (freq, at, duration) => {
    const oscillator = c.createOscillator()
    const gain = c.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    oscillator.connect(gain)
    gain.connect(c.destination)
    oscillator.start(at)
    oscillator.stop(at + duration)
  }

  note(880, c.currentTime, 0.35)
  note(1174.66, c.currentTime + 0.18, 0.45)
}
