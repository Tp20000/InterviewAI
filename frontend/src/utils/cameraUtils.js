/**
 * Nuclear camera stop - kills ALL media streams in the page.
 * Call this before any navigation away from interview room.
 */
export function stopAllMedia() {
  console.log("[stopAllMedia] Stopping all media streams...")

  // Step 1: Use VideoPanel exposed stop fn
  try {
    if (typeof window.__stopInterviewCamera === "function") {
      window.__stopInterviewCamera()
    }
  } catch(e) {}

  // Step 2: Stop ALL video/audio elements on page
  try {
    document.querySelectorAll("video, audio").forEach(el => {
      try {
        if (el.srcObject) {
          el.srcObject.getTracks().forEach(track => {
            track.stop()
            console.log("[stopAllMedia] Stopped track:", track.kind, track.label)
          })
          el.srcObject = null
          el.load()
        }
        el.pause()
      } catch(e) {}
    })
  } catch(e) {}

  // Step 3: Stop speech synthesis
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  } catch(e) {}

  // Step 4: Exit fullscreen
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  } catch(e) {}

  console.log("[stopAllMedia] Done - camera light should be off")
}