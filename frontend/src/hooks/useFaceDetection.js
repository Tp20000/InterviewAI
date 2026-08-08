import { useRef, useState, useEffect } from "react"

export const useFaceDetection = (videoRef, isActive, onCheat) => {
  const [faceCount, setFaceCount]       = useState(1)
  const [faceDetected, setFaceDetected] = useState(true)
  const [modelLoaded, setModelLoaded]   = useState(false)
  const intervalRef   = useRef(null)
  const noFaceTimer   = useRef(null)
  const lastCheatRef  = useRef({})
  const faceapiRef    = useRef(null)

  const fireCheat = (type, severity, desc, cooldownMs) => {
    const now  = Date.now()
    const last = lastCheatRef.current[type] || 0
    if (now - last < (cooldownMs || 8000)) return
    lastCheatRef.current[type] = now
    console.log("[FaceDetection] CHEAT:", type, severity, desc)
    if (onCheat) onCheat({ type, severity, description: desc })
  }

  useEffect(() => {
    if (!isActive) {
      console.log("[FaceDetection] Not active, skipping")
      return
    }

    console.log("[FaceDetection] Starting face detection...")

    let mounted = true

    const initFaceApi = async () => {
      try {
        const faceapi = await import("face-api.js")
        faceapiRef.current = faceapi

        console.log("[FaceDetection] face-api.js imported, loading models...")

        // Load tiny face detector model
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models")

        console.log("[FaceDetection] Models loaded successfully!")
        setModelLoaded(true)

        if (mounted) {
          startFaceDetection(faceapi)
        }
      } catch (err) {
        console.error("[FaceDetection] Model loading failed:", err)
        console.log("[FaceDetection] Falling back to video stream check")
        if (mounted) {
          startFallbackDetection()
        }
      }
    }

    const startFaceDetection = (faceapi) => {
      console.log("[FaceDetection] Starting interval detection with face-api.js")

      if (intervalRef.current) clearInterval(intervalRef.current)

      intervalRef.current = setInterval(async () => {
        // Check if video element exists and has data
        if (!videoRef || !videoRef.current) {
          console.log("[FaceDetection] No video ref")
          return
        }

        const video = videoRef.current
        if (!video.videoWidth || video.videoWidth < 10) {
          console.log("[FaceDetection] Video not ready, width:", video.videoWidth)
          return
        }

        if (video.paused || video.ended) {
          console.log("[FaceDetection] Video paused/ended")
          return
        }

        try {
          const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.3
          })

          const detections = await faceapi.detectAllFaces(video, options)
          const count = detections.length

          console.log("[FaceDetection] Detected " + count + " face(s)")

          setFaceCount(count)
          setFaceDetected(count > 0)

          // NO FACE DETECTED
          if (count === 0) {
            if (!noFaceTimer.current) {
              console.log("[FaceDetection] Starting no-face timer (5s)")
              noFaceTimer.current = setTimeout(() => {
                console.log("[FaceDetection] VIOLATION: No face for 5+ seconds!")
                fireCheat("face_not_detected", "high", "No face detected in camera for 5+ seconds", 10000)
                noFaceTimer.current = null
              }, 5000)
            }
          } else {
            // Face found - clear the no-face timer
            if (noFaceTimer.current) {
              console.log("[FaceDetection] Face found, clearing timer")
              clearTimeout(noFaceTimer.current)
              noFaceTimer.current = null
            }
          }

          // MULTIPLE FACES
          if (count > 1) {
            console.log("[FaceDetection] VIOLATION: Multiple faces!")
            fireCheat("multiple_faces", "critical", count + " faces detected - possible assistance", 8000)
          }

          // FACE TOO SMALL (looking away or phone in front)
          if (count === 1 && detections[0]) {
            const box    = detections[0].box
            const vw     = video.videoWidth  || 640
            const vh     = video.videoHeight || 480
            const area   = (box.width * box.height) / (vw * vh)

            // If face takes less than 3% of frame, person is far or looking away
            if (area < 0.03) {
              console.log("[FaceDetection] Face area too small:", (area * 100).toFixed(1) + "%")
              fireCheat("looking_away", "medium", "Face appears too small or looking away from screen", 15000)
            }

            // Check if face is at edge of frame (looking sideways)
            const centerX = (box.x + box.width / 2) / vw
            const centerY = (box.y + box.height / 2) / vh

            if (centerX < 0.15 || centerX > 0.85) {
              fireCheat("looking_away", "medium", "Candidate appears to be looking sideways", 12000)
            }
            if (centerY < 0.1 || centerY > 0.9) {
              fireCheat("looking_away", "low", "Face at edge of camera frame", 20000)
            }
          }

        } catch (err) {
          console.warn("[FaceDetection] Detection error:", err.message)
        }
      }, 1500) // Check every 1.5 seconds
    }

    const startFallbackDetection = () => {
      console.log("[FaceDetection] Using fallback video stream check")
      if (intervalRef.current) clearInterval(intervalRef.current)

      intervalRef.current = setInterval(() => {
        if (!videoRef || !videoRef.current) return
        const video = videoRef.current
        const isPlaying = video.readyState >= 2 && !video.paused && !video.ended

        setFaceDetected(isPlaying)
        setFaceCount(isPlaying ? 1 : 0)

        if (!isPlaying) {
          fireCheat("camera_stopped", "high", "Camera feed appears to have stopped", 15000)
        }
      }, 3000)
    }

    initFaceApi()

    return () => {
      mounted = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (noFaceTimer.current) {
        clearTimeout(noFaceTimer.current)
        noFaceTimer.current = null
      }
    }
  }, [isActive])

  return { faceCount, faceDetected, modelLoaded }
}