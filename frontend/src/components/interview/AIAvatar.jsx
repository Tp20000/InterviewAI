import { useEffect, useState } from "react"

const AIAvatar = ({ isSpeaking, isThinking }) => {
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!isSpeaking) { setPulse(0); return }
    var interval = setInterval(function() { setPulse(function(p) { return (p + 1) % 3 }) }, 400)
    return function() { clearInterval(interval) }
  }, [isSpeaking])

  var ringClass = ""
  if (isSpeaking) ringClass = "bg-blue-600 shadow-lg shadow-blue-500/50 scale-105"
  else if (isThinking) ringClass = "bg-purple-700 shadow-lg shadow-purple-500/30"
  else ringClass = "bg-slate-700"

  var statusBg = ""
  var statusText = ""
  if (isSpeaking) { statusBg = "bg-blue-900/50 text-blue-300 border border-blue-700"; statusText = "Speaking..." }
  else if (isThinking) { statusBg = "bg-purple-900/50 text-purple-300 border border-purple-700"; statusText = "Thinking..." }
  else { statusBg = "bg-slate-800 text-slate-400 border border-slate-700"; statusText = "Listening" }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {isSpeaking && (
          <><div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
          <div className="absolute -inset-2 rounded-full bg-blue-500/10 animate-pulse" /></>
        )}
        <div className={"w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 " + ringClass}>
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-lg">Alex</p>
        <p className="text-slate-400 text-xs">AI Interviewer</p>
      </div>
      <div className={"flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all " + statusBg}>
        {isSpeaking && (
          <span className="flex gap-0.5">
            {[0,1,2].map(function(i) {
              return <span key={i} className={"w-1 rounded-full bg-blue-400 transition-all duration-200 " + (pulse === i ? "h-3" : "h-1")} />
            })}
          </span>
        )}
        {isThinking && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
        {!isSpeaking && !isThinking && <span className="w-2 h-2 rounded-full bg-slate-500" />}
        <span>{statusText}</span>
      </div>
    </div>
  )
}
export default AIAvatar