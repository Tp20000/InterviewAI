import { useState, useRef, useEffect } from "react"

const MicIcon = ({ active }) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    {active && <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />}
  </svg>
)

const StopIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

const SpeechInput = ({ onSubmit, disabled, placeholder }) => {
  const [text, setText]           = useState("")
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [interim, setInterim]     = useState("")
  const recRef      = useRef(null)
  const startRef    = useRef(null)

  useEffect(() => {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    setSupported(true)
    var rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = "en-US"
    rec.onresult = function(e) {
      var finalText  = ""
      var interimText = ""
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t + " "
        else interimText += t
      }
      if (finalText) setText(function(p) { return (p + " " + finalText).trim() })
      setInterim(interimText)
    }
    rec.onerror = function() { setListening(false); setInterim("") }
    rec.onend   = function() { setListening(false); setInterim("") }
    recRef.current = rec
    return function() { try { rec.stop() } catch(e) {} }
  }, [])

  var toggleMic = function() {
    if (!recRef.current) return
    if (listening) {
      try { recRef.current.stop() } catch(e) {}
      setListening(false)
      setInterim("")
    } else {
      startRef.current = Date.now()
      setText("")
      setInterim("")
      try { recRef.current.start(); setListening(true) } catch(e) {}
    }
  }

  var handleSubmit = function() {
    var finalText = (text + " " + interim).trim()
    if (!finalText || disabled) return
    var dur = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 30
    if (listening) { try { recRef.current.stop() } catch(e) {} }
    setListening(false)
    setInterim("")
    setText("")
    startRef.current = null
    onSubmit(finalText, dur)
  }

  var handleKey = function(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit() }
  }

  var displayText = text + (interim ? " " + interim : "")
  var wordCount = displayText.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          rows={4}
          value={displayText}
          onChange={function(e) { setText(e.target.value); setInterim("") }}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={placeholder || "Speak or type your answer... (Ctrl+Enter to submit)"}
          className={"input-field resize-none pr-14 leading-relaxed " + (listening ? "border-red-500/50 ring-1 ring-red-500/30" : "")}
        />
        {supported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={disabled}
            className={"absolute right-3 top-3 w-9 h-9 rounded-full flex items-center justify-center transition-all " + (
              listening ? "bg-red-600 text-white shadow-lg shadow-red-500/40 animate-pulse" : "bg-slate-600 hover:bg-slate-500 text-white"
            )}
            title={listening ? "Stop recording" : "Start voice input"}
          >
            {listening ? <StopIcon /> : <MicIcon active={false} />}
          </button>
        )}
        {!supported && (
          <div className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center text-slate-600" title="Voice not supported in this browser">
            <MicIcon active={true} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {listening && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <div className="flex gap-0.5">
                {[0,1,2].map(function(i) { return <div key={i} className="w-1 bg-red-400 rounded-full animate-bounce" style={{ height:"8px", animationDelay: (i*0.15)+"s" }} /> })}
              </div>
              Recording...
            </div>
          )}
          {!listening && displayText && (
            <span className="text-slate-500 text-xs">{wordCount} words - Ctrl+Enter to submit</span>
          )}
          {!supported && <span className="text-yellow-500 text-xs">Voice not supported - please type</span>}
        </div>
        <div className="flex items-center gap-2">
          {displayText && (
            <button type="button" onClick={function() { setText(""); setInterim("") }}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded transition-colors">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!displayText.trim() || disabled}
            className="btn-primary text-sm py-2 px-5 flex items-center gap-2 disabled:opacity-40"
          >
            <SendIcon /> Submit
          </button>
        </div>
      </div>
    </div>
  )
}
export default SpeechInput