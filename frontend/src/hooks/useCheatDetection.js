import { useEffect, useRef, useCallback } from "react"

export const useCheatDetection = (isActive, onCheat) => {
  const lastFiredRef = useRef({})

  const fireCheat = useCallback((type, severity, description, cooldownMs = 8000) => {
    const now  = Date.now()
    const last = lastFiredRef.current[type] || 0
    if (now - last < cooldownMs) return
    lastFiredRef.current[type] = now
    if (onCheat) onCheat({ type, severity, description })
  }, [onCheat])

  useEffect(() => {
    if (!isActive) return

    // Tab switch / window blur
    const handleBlur = () => {
      fireCheat("tab_switch", "high", "Browser window lost focus", 10000)
    }

    // Visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        fireCheat("tab_switch", "high", "Browser tab hidden", 10000)
      }
    }

    // Paste detection
    const handlePaste = () => {
      fireCheat("copy_paste", "medium", "Paste event detected during interview", 15000)
    }

    // Right click
    const handleContextMenu = (e) => {
      e.preventDefault()
      fireCheat("right_click", "low", "Right-click during interview", 30000)
    }

    // Keyboard shortcuts
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        fireCheat("copy_paste", "low", "Ctrl+C detected during interview", 20000)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        fireCheat("copy_paste", "medium", "Ctrl+V detected during interview", 15000)
      }
    }

    window.addEventListener("blur",               handleBlur)
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("paste",              handlePaste)
    document.addEventListener("contextmenu",      handleContextMenu)
    window.addEventListener("keydown",            handleKeyDown)

    return () => {
      window.removeEventListener("blur",               handleBlur)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("paste",              handlePaste)
      document.removeEventListener("contextmenu",      handleContextMenu)
      window.removeEventListener("keydown",            handleKeyDown)
    }
  }, [isActive, fireCheat])

  return { fireCheat }
}