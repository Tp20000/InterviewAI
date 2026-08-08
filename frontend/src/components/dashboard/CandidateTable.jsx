import { getInitials } from "../../utils/helpers"

const STATUS_COLORS = {
  scheduled:   "badge-yellow",
  in_progress: "badge-blue",
  completed:   "badge-green",
  disqualified:"badge-red",
  terminated:  "badge-red"
}

const CandidateTable = ({ candidates = [], onViewReport }) => {
  if (!candidates.length)
    return <p className="text-slate-400 text-sm text-center py-8">No candidates yet.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left text-slate-400 font-medium pb-3 pr-4">Candidate</th>
            <th className="text-left text-slate-400 font-medium pb-3 pr-4">Status</th>
            <th className="text-left text-slate-400 font-medium pb-3 pr-4">Score</th>
            <th className="text-left text-slate-400 font-medium pb-3 pr-4">Grade</th>
            <th className="text-left text-slate-400 font-medium pb-3 pr-4">Cheat</th>
            <th className="text-left text-slate-400 font-medium pb-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {candidates.map((c, i) => {
            const score = c.total_score
            const grade = score == null ? "—"
              : score >= 90 ? "A+" : score >= 80 ? "A"
              : score >= 70 ? "B+" : score >= 60 ? "B"
              : score >= 50 ? "C" : "F"

            return (
              <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {getInitials(c.candidate?.full_name || "")}
                    </div>
                    <div>
                      <p className="text-white font-medium">{c.candidate?.full_name || "Unknown"}</p>
                      <p className="text-slate-500 text-xs">{c.candidate?.email || ""}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className={STATUS_COLORS[c.status] || "badge-blue"}>
                    {c.status?.replace("_", " ")}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-white font-semibold">
                    {score != null ? `${score.toFixed(1)}%` : "—"}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`font-bold text-lg ${
                    grade === "A+" || grade === "A" ? "text-green-400"
                    : grade === "B+" || grade === "B" ? "text-blue-400"
                    : grade === "C" ? "text-yellow-400"
                    : grade === "F" ? "text-red-400" : "text-slate-400"
                  }`}>{grade}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-xs font-medium ${
                    (c.cheat_score || 0) >= 50 ? "text-red-400"
                    : (c.cheat_score || 0) >= 20 ? "text-yellow-400"
                    : "text-green-400"
                  }`}>
                    {(c.cheat_score || 0).toFixed(0)}%
                  </span>
                </td>
                <td className="py-3">
                  {c.status === "completed" && onViewReport && (
                    <button
                      onClick={() => onViewReport(c.session_id)}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                    >
                      View Report →
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
export default CandidateTable