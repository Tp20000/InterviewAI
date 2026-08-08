import { useEffect, useRef, useState, useCallback } from "react"
import { useFaceDetection } from "../../hooks/useFaceDetection"

const VideoPanel = ({ onStreamReady, onError, onCheat, isActive, compact }) => {
  const videoRef   = useRef(null)
  const streamRef  = useRef(null)
  const retryRef   = useRef(null)
  const mountedRef = useRef(true)

  const [camOk,    setCamOk]    = useState(false)
  const [camErr,   setCamErr]   = useState("")
  const [muted,    setMuted]    = useState(false)
  const [camOff,   setCamOff]   = useState(false)
  const [retrying, setRetrying] = useState(false)

  const { faceCount, faceDetected, modelLoaded } = useFaceDetection(
    videoRef,
    isActive && camOk,
    onCheat
  )

  // ── Stop ALL camera tracks ──────────────────────────────
  const stopAllTracks = useCallback(() => {
    if (retryRef.current) {
      clearTimeout(retryRef.current)
      retryRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop()
          console.log("[Camera] Stopped:", track.kind, track.label)
        } catch(e) {}
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause()
        videoRef.current.srcObject = null
        videoRef.current.load()
      } catch(e) {}
    }
    if (mountedRef.current) setCamOk(false)
    console.log("[Camera] All tracks stopped")
  }, [])

  // ── Start camera with retry ─────────────────────────────
  const startCamera = useCallback(async (attempt = 0) => {
    if (!mountedRef.current) return
    setRetrying(attempt > 0)
    setCamErr("")

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop() } catch(e) {} })
      streamRef.current = null
    }

    if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt))
    if (!mountedRef.current) return

    const constraintOptions = [
      { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: true },
      { video: { facingMode: "user" }, audio: true },
      { video: true, audio: true },
      { video: true, audio: false }
    ]

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API not supported")

      const constraints = constraintOptions[Math.min(attempt, constraintOptions.length - 1)]
      console.log("[Camera] Attempt", attempt + 1, constraints)

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise(resolve => {
          const vid = videoRef.current
          if (!vid) { resolve(); return }
          if (vid.readyState >= 1) { resolve(); return }
          vid.addEventListener("loadedmetadata", resolve, { once: true })
          setTimeout(resolve, 3000)
        })
        await videoRef.current.play().catch(() => {})
      }

      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

      setCamOk(true)
      setCamErr("")
      setRetrying(false)
      console.log("[Camera] Started on attempt", attempt + 1)
      if (onStreamReady) onStreamReady(stream)

    } catch (err) {
      console.error("[Camera] Attempt", attempt + 1, "failed:", err.name, err.message)
      if (!mountedRef.current) return

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCamErr("Camera access denied. Click the camera icon in your browser address bar and allow access.")
        if (onError) onError("Camera access denied")
        return
      }
      if (err.name === "NotFoundError") {
        setCamErr("No camera found. Please connect a camera and refresh.")
        if (onError) onError("No camera found")
        return
      }

      const msg = err.name === "NotReadableError"
        ? "Camera is in use by another app. Please close other apps using the camera."
        : (err.message || "Camera not available.")

      if (attempt < 3) {
        setCamErr("Retrying camera... (" + (attempt + 1) + "/3)")
        retryRef.current = setTimeout(() => {
          if (mountedRef.current) startCamera(attempt + 1)
        }, (attempt + 1) * 800)
      } else {
        setCamErr(msg)
        setRetrying(false)
        if (onError) onError(msg)
      }
    }
  }, [onStreamReady, onError])

  // ── Mount: start camera, expose stop globally ───────────
  useEffect(() => {
    mountedRef.current = true
    startCamera(0)

    // Expose so InterviewRoom can force-stop
    window.__stopInterviewCamera = stopAllTracks

    // ⚡ KEY FIX: unmount = stop camera immediately
    return () => {
      console.log("[Camera] Component unmounting - stopping camera NOW")
      mountedRef.current = false
      stopAllTracks()
      delete window.__stopInterviewCamera
    }
  }, [])

  // ── Handle camera physically disconnected ───────────────
  useEffect(() => {
    if (!camOk || !streamRef.current) return
    const handleEnd = () => {
      if (!mountedRef.current) return
      setCamOk(false)
      setCamErr("Camera disconnected. Reconnecting...")
      retryRef.current = setTimeout(() => {
        if (mountedRef.current) startCamera(0)
      }, 1500)
    }
    const tracks = streamRef.current.getTracks()
    tracks.forEach(t => t.addEventListener("ended", handleEnd))
    return () => tracks.forEach(t => t.removeEventListener("ended", handleEnd))
  }, [camOk])

  const toggleMic = () => {
    if (!streamRef.current) return
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = muted })
    setMuted(m => !m)
  }

  const toggleCam = () => {
    if (!streamRef.current) return
    streamRef.current.getVideoTracks().forEach(t => { t.enabled = camOff })
    setCamOff(c => !c)
  }

  const height = compact ? "h-36" : "h-48"

  // ── ERROR ───────────────────────────────────────────────
  if (camErr && !retrying) return (
    <div className={"relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 " + height}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
        <p className="text-red-400 text-xs text-center leading-relaxed">{camErr}</p>
        <button onClick={() => startCamera(0)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">
          Retry Camera
        </button>
      </div>
    </div>
  )

  // ── LOADING ─────────────────────────────────────────────
  if (retrying || (!camOk && !camErr)) return (
    <div className={"relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 " + height}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-xs text-center px-3">
          {camErr || "Starting camera..."}
        </p>
      </div>
    </div>
  )

  const faceStatusBg   = !faceDetected || faceCount === 0 ? "bg-red-900/80 text-red-300"
    : faceCount > 1 ? "bg-orange-900/80 text-orange-300"
    : "bg-green-900/80 text-green-300"
  const faceStatusText = !faceDetected || faceCount === 0 ? "No face!"
    : faceCount > 1 ? faceCount + " faces!" : "Face OK"

  // ── ACTIVE ──────────────────────────────────────────────
  return (
    <div className={"relative bg-slate-900 rounded-xl overflow-hidden " + height + (
      isActive
        ? !faceDetected || faceCount === 0 ? " ring-2 ring-red-500/60"
          : faceCount > 1 ? " ring-2 ring-orange-500/60"
          : " ring-1 ring-green-500/20"
        : ""
    )}>
      <video
        ref={videoRef}
        autoPlay muted playsInline
        className={"w-full h-full object-cover" + (camOff ? " opacity-0" : "")}
        style={{ transform: "scaleX(-1)" }}
      />

      {camOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
      )}

      {camOk && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white text-xs font-medium">LIVE</span>
          </div>
          {isActive && (
            <div className={"flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm " + faceStatusBg}>
              <span>{faceStatusText}</span>
            </div>
          )}
        </div>
      )}

      {isActive && camOk && !modelLoaded && (
        <div className="absolute bottom-8 left-2 right-2 pointer-events-none">
          <div className="bg-yellow-900/80 text-yellow-300 text-xs rounded-full px-2 py-0.5 text-center">
            Loading face detection...
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
        <button onClick={toggleMic}
          className={"w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm " + (
            muted ? "bg-red-600 text-white" : "bg-black/50 text-white hover:bg-black/70"
          )} title={muted ? "Unmute" : "Mute"}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
        <button onClick={toggleCam}
          className={"w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm " + (
            camOff ? "bg-red-600 text-white" : "bg-black/50 text-white hover:bg-black/70"
          )} title={camOff ? "Show" : "Hide"}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </button>
        <button onClick={() => startCamera(0)}
          className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/50 text-white hover:bg-black/70"
          title="Restart camera">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  )
}
export default VideoPanel