// Desktop notifications for timer completion, so it's visible even if the
// tab is backgrounded or minimized. Permission can only be requested from a
// user gesture, so requestNotificationPermission() is called alongside
// unlockAudio() from Timer's Start button.

export function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function notify(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    // Some environments (e.g. a PWA without an active service worker) reject
    // the direct Notification constructor — the audio alarm still fires.
  }
}
