import { useState, useRef, useEffect } from "react"

export const useSpeech = (onResult) => {
  const [listening,  setListening]  = useState(false)
  const [supported,  setSupported]  = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interim,    setInterim]    = useState("")
  const recRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    setSupported(true)

    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = "en-US"

    rec.onresult = (e) => {
      let final = ""
      let inter = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + " "
        else inter += t
      }
      if (final) {
        setTranscript(p => (p + " " + final).trim())
        if (onResult) onResult(final.trim(), false)
      }
      setInterim(inter)
    }

    rec.onerror = () => { setListening(false); setInterim("") }
    rec.onend   = () => { setListening(false); setInterim("") }

    recRef.current = rec
    return () => { try { rec.stop() } catch(e) {} }
  }, [])

  const startListening = () => {
    if (!recRef.current || listening) return
    setTranscript("")
    setInterim("")
    try { recRef.current.start(); setListening(true) } catch(e) {}
  }

  const stopListening = () => {
    if (!recRef.current || !listening) return
    try { recRef.current.stop() } catch(e) {}
    setListening(false)
    setInterim("")
  }

  const clearTranscript = () => { setTranscript(""); setInterim("") }

  return {
    listening, supported, transcript, interim,
    startListening, stopListening, clearTranscript,
    fullText: (transcript + " " + interim).trim()
  }
}