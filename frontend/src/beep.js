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

function note(c, freq, at, duration, peak = 0.12) {
  const oscillator = c.createOscillator()
  const gain = c.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  oscillator.connect(gain)
  gain.connect(c.destination)
  oscillator.start(at)
  oscillator.stop(at + duration)
}

export function playBeep() {
  const c = getContext()
  if (!c) return
  if (c.state === 'suspended') c.resume()

  note(c, 880, c.currentTime, 0.35)
  note(c, 1174.66, c.currentTime + 0.18, 0.45)
}

// A more insistent, repeating ring for when a user-set countdown timer runs
// out — distinct from the softer pomodoro phase-change chime above.
export function playAlarm() {
  const c = getContext()
  if (!c) return
  if (c.state === 'suspended') c.resume()

  for (let i = 0; i < 3; i++) {
    const start = c.currentTime + i * 0.55
    note(c, 988, start, 0.22, 0.16)
    note(c, 1318.51, start + 0.24, 0.28, 0.16)
  }
}
