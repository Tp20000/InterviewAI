import { calculateGrade, getGradeColor } from "../../utils/helpers"

const ScoreCard = ({ score, label = "Score", showGrade = true, size = "md" }) => {
  const grade = calculateGrade(score)
  const gradeColor = getGradeColor(grade)

  const radius = size === "lg" ? 54 : 40
  const strokeW = size === "lg" ? 10 : 8
  const dim = (radius + strokeW) * 2
  const circ = 2 * Math.PI * radius
  const offset = score != null ? circ - (Math.min(score, 100) / 100) * circ : circ

  const color = score == null ? "#475569"
    : score >= 70 ? "#22c55e"
    : score >= 50 ? "#3b82f6"
    : "#ef4444"

  const textSize = size === "lg" ? "text-2xl" : "text-lg"
  const subSize  = size === "lg" ? "text-sm"  : "text-xs"

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="-rotate-90">
          <circle
            cx={dim/2} cy={dim/2} r={radius}
            fill="none" stroke="#1e293b" strokeWidth={strokeW}
          />
          <circle
            cx={dim/2} cy={dim/2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeW}
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showGrade && (
            <span className={"font-black " + textSize + " " + gradeColor}>{grade}</span>
          )}
          <span className={"text-white font-bold " + subSize}>
            {score != null ? score.toFixed(1) + "%" : "N/A"}
          </span>
        </div>
      </div>
      {label && <p className="text-slate-400 text-xs">{label}</p>}
    </div>
  )
}
export default ScoreCard