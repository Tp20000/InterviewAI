import { useEffect, useState } from "react"

const CheatAlert = ({ events }) => {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    if (!events || events.length === 0) return
    var latest = events[events.length - 1]
    setCurrent(latest)
    setVisible(true)
    var timer = setTimeout(() => { setVisible(false) }, 3500)
    return () => { clearTimeout(timer) }
  }, [events ? events.length : 0])

  if (!visible || !current) return null

  // Safely get label from event (might be string or object)
  var label = "Violation detected"
  if (typeof current === "string") {
    label = current
  } else if (current && typeof current === "object") {
    if (current.description && typeof current.description === "string") label = current.description
    else if (current.type && typeof current.type === "string") label = current.type.replace(/_/g, " ")
  }

  var sev = "medium"
  if (current && current.severity && typeof current.severity === "string") sev = current.severity

  var bg = "bg-yellow-600"
  if (sev === "critical") bg = "bg-red-600"
  if (sev === "high")     bg = "bg-orange-600"

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in pointer-events-none">
      <div className={bg + " px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-2xl flex items-center gap-2"}>
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{label}</span>
      </div>
    </div>
  )
}
export default CheatAlert