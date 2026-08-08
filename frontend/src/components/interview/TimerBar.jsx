import { useEffect, useState, useRef } from "react"

const TimerBar = ({ durationMinutes = 45, onTimeUp, isActive = true }) => {
  const totalSeconds = durationMinutes * 60
  const [timeLeft, setTimeLeft] = useState(totalSeconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isActive) return
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          onTimeUp && onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [isActive])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const pct     = (timeLeft / totalSeconds) * 100
  const isLow   = timeLeft < 300  // last 5 min
  const isCrit  = timeLeft < 60   // last 1 min

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-slate-400 text-xs">Time Remaining</span>
        <span className={`font-mono font-bold text-sm ${
          isCrit ? "text-red-400 animate-pulse"
          : isLow ? "text-yellow-400"
          : "text-white"
        }`}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isCrit ? "bg-red-500"
            : isLow ? "bg-yellow-500"
            : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
export default TimerBar