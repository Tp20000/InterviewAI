import { useState, useRef, useCallback } from "react"

export const useCamera = () => {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [camOk,  setCamOk]  = useState(false)
  const [camErr, setCamErr] = useState("")

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCamOk(true)
      setCamErr("")
      return stream
    } catch (err) {
      let msg = "Camera not available"
      if (err.name === "NotAllowedError") msg = "Camera access denied"
      if (err.name === "NotFoundError")   msg = "No camera found"
      setCamErr(msg)
      return null
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCamOk(false)
  }, [])

  const toggleMic = useCallback(() => {
    if (!streamRef.current) return
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
  }, [])

  const toggleVideo = useCallback(() => {
    if (!streamRef.current) return
    streamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
  }, [])

  return { videoRef, streamRef, camOk, camErr, startCamera, stopCamera, toggleMic, toggleVideo }
}