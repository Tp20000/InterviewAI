import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { interviewService } from "../services/interviewService"
import LoadingSpinner from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"

function formatDate(d) {
  if (!d) return "N/A"
  return new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
}
function grade(score) {
  if (score == null) return "N/A"
  if (score >= 90) return "A+"
  if (score >= 80) return "A"
  if (score >= 70) return "B+"
  if (score >= 60) return "B"
  if (score >= 50) return "C"
  return "F"
}
function gradeColor(g) {
  if (!g || g === "N/A") return "text-slate-400"
  if (g.startsWith("A")) return "text-green-400"
  if (g.startsWith("B")) return "text-blue-400"
  if (g === "C")          return "text-yellow-400"
  return "text-red-400"
}
function scoreColor(s) {
  if (s == null) return "text-slate-400"
  if (s >= 70)   return "text-green-400"
  if (s >= 50)   return "text-yellow-400"
  return "text-red-400"
}
function barColor(s) {
  if (s >= 70) return "bg-green-500"
  if (s >= 50) return "bg-yellow-500"
  return "bg-red-500"
}

const ScoreRing = ({ score }) => {
  const s      = score || 0
  const r      = 54
  const circ   = 2 * Math.PI * r
  const offset = circ - (s / 100) * circ
  const color  = s >= 70 ? "#22c55e" : s >= 50 ? "#3b82f6" : "#ef4444"
  const g      = grade(s)
  return (
    <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
      <svg width="160" height="160" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circ + " " + circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={"text-2xl font-black " + gradeColor(g)}>{g}</span>
        <span className="text-white text-sm font-bold">{s.toFixed(1)}%</span>
      </div>
    </div>
  )
}

const Results = () => {
  const { sessionId } = useParams()
  const navigate      = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState("")
  const [genRep,  setGenRep]  = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)

  useEffect(() => { loadResults() }, [sessionId])

  const loadResults = async () => {
    try {
      setLoading(true)
      setErr("")
      const res = await interviewService.getReport(sessionId)
      setData(res.data)

      // Auto-generate report if missing
      if (!res.data.report && res.data.session?.status === "completed") {
        setAutoGenerating(true)
        try {
          await interviewService.generateReport(sessionId)
          const res2 = await interviewService.getReport(sessionId)
          setData(res2.data)
          toast.success("Report generated!")
        } catch(e) {
          console.warn("Auto report generation failed:", e)
        } finally {
          setAutoGenerating(false)
        }
      }
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Failed to load results")
    } finally {
      setLoading(false)
    }
  }

  const handleGenReport = async () => {
    try {
      setGenRep(true)
      await interviewService.generateReport(sessionId)
      toast.success("Report generated!")
      loadResults()
    } catch { toast.error("Failed to generate report") }
    finally { setGenRep(false) }
  }

  // ── LOADING ──────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <LoadingSpinner size="lg" text="Loading your results..." />
    </div>
  )

  // ── ERROR ────────────────────────────────────────────────
  if (err || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="card text-center max-w-md">
        <I name="warning" size={12} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-3">Results Not Found</h2>
        <p className="text-red-400 mb-2 text-sm">{err}</p>
        <p className="text-slate-500 text-xs mb-6">
          The interview may still be processing. Try again in a moment.
        </p>
        <div className="flex gap-3">
          <button onClick={loadResults} className="btn-secondary flex-1">Retry</button>
          <button onClick={() => navigate("/candidate")} className="btn-primary flex-1">Dashboard</button>
        </div>
      </div>
    </div>
  )

  const {
    summary    = {},
    session    = {},
    candidate  = {},
    interview  = {},
    qa_pairs   = [],
    report,
    cheat_logs = []
  } = data

  const score  = summary.total_score || 0
  const g      = grade(score)
  const isDisq = session.status === "disqualified"

  const barData = qa_pairs.slice(0, 10).map((q, i) => ({
    name:  "Q" + (i + 1),
    score: Math.round((q.ai_score || 0) * 10)
  }))

  let strengths  = []
  let weaknesses = []
  if (report) {
    try { strengths  = JSON.parse(report.strengths  || "[]") } catch(e) {}
    try { weaknesses = JSON.parse(report.weaknesses || "[]") } catch(e) {}
  }

  const recColor = {
    strongly_recommend: "bg-green-900/30 text-green-300 border-green-800/50",
    recommend:          "bg-blue-900/30 text-blue-300 border-blue-800/50",
    neutral:            "bg-yellow-900/30 text-yellow-300 border-yellow-800/50",
    not_recommend:      "bg-red-900/30 text-red-300 border-red-800/50"
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-16">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Interview Results</h1>
            <p className="text-slate-400 mt-1 text-sm">
              {interview.title || "Interview"} · {formatDate(session.ended_at)}
            </p>
          </div>
          <div className="flex gap-3">
            {!report && !autoGenerating && (
              <button onClick={handleGenReport} disabled={genRep} className="btn-secondary text-sm">
                {genRep ? <><LoadingSpinner size="xs" text="" /> Generating...</> : "Generate Report"}
              </button>
            )}
            {autoGenerating && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <LoadingSpinner size="xs" text="" /> Generating report...
              </div>
            )}
            <button onClick={() => navigate("/candidate")} className="btn-secondary text-sm">
              <I name="home" size={4} /> Dashboard
            </button>
          </div>
        </div>

        {/* Disqualified banner */}
        {isDisq && (
          <div className="bg-red-900/30 border border-red-700 rounded-2xl p-5 mb-6 flex items-center gap-4">
            <I name="warning" size={8} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-red-300 font-bold text-lg">Interview Disqualified</h3>
              <p className="text-slate-400 text-sm mt-1">
                {session.disqualification_reason || "Multiple violations detected"}
              </p>
            </div>
          </div>
        )}

        {/* Score Hero */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <ScoreRing score={score} />
            <div className="flex-1 w-full">
              <h2 className="text-2xl font-black text-white mb-4">
                {score >= 80 ? "🎉 Excellent Performance!"
                  : score >= 65 ? "👍 Good Job!"
                  : score >= 50 ? "📚 Keep Practicing!"
                  : "💪 Needs Improvement"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Final Score",  value: score.toFixed(1) + "%", color: gradeColor(g) },
                  { label: "Grade",        value: g,                        color: gradeColor(g) },
                  { label: "Percentile",   value: summary.percentile
                      ? "Top " + Math.round(100 - summary.percentile) + "%"
                      : "N/A",                                               color: "text-blue-400" },
                  { label: "Violations",   value: String(cheat_logs.length), color: cheat_logs.length > 0 ? "text-red-400" : "text-green-400" }
                ].map(s => (
                  <div key={s.label} className="bg-slate-700/40 rounded-xl p-3 text-center">
                    <p className="text-slate-400 text-xs mb-1">{s.label}</p>
                    <p className={"text-2xl font-black " + s.color}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Score chart */}
          <div className="card">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <I name="chart" size={5} /> Score Per Question
            </h3>
            {barData.length > 0 ? (
              <div className="space-y-2">
                {barData.map(item => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs w-8 flex-shrink-0">{item.name}</span>
                    <div className="flex-1 h-6 bg-slate-700 rounded-lg overflow-hidden">
                      <div
                        className={"h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-700 " + barColor(item.score)}
                        style={{ width: Math.max(item.score, 4) + "%" }}
                      >
                        <span className="text-white text-xs font-bold">{item.score}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-slate-500 text-sm">No answers recorded</p>
              </div>
            )}
          </div>

          {/* AI Report */}
          <div className="card">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <I name="robot" size={5} /> AI Analysis
            </h3>
            {report ? (
              <div className="space-y-4">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase mb-2">Summary</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{report.summary}</p>
                </div>
                {strengths.length > 0 && (
                  <div>
                    <p className="text-green-400 text-xs font-semibold uppercase mb-2 flex items-center gap-1">
                      <I name="check" size={3} /> Strengths
                    </p>
                    <ul className="space-y-1.5">
                      {strengths.map((s, i) => (
                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                          <I name="check" size={3} className="text-green-400 flex-shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {weaknesses.length > 0 && (
                  <div>
                    <p className="text-red-400 text-xs font-semibold uppercase mb-2 flex items-center gap-1">
                      <I name="warning" size={3} /> Areas to Improve
                    </p>
                    <ul className="space-y-1.5">
                      {weaknesses.map((w, i) => (
                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                          <I name="warning" size={3} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.recommendation && (
                  <div className={"text-center py-2.5 rounded-xl text-sm font-bold border " + (
                    recColor[report.recommendation] || recColor.neutral
                  )}>
                    {report.recommendation.replace(/_/g, " ").toUpperCase()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <I name="doc" size={10} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-4">
                  {autoGenerating ? "Generating report..." : "No AI report yet"}
                </p>
                {autoGenerating
                  ? <LoadingSpinner size="sm" text="" />
                  : (
                    <button onClick={handleGenReport} disabled={genRep} className="btn-primary text-sm">
                      {genRep ? "Generating..." : "Generate Report"}
                    </button>
                  )
                }
              </div>
            )}
          </div>
        </div>

        {/* Q&A Breakdown */}
        {qa_pairs.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <I name="doc" size={5} /> Q&A Breakdown
            </h3>
            <div className="space-y-4">
              {qa_pairs.map((qa, i) => {
                const s10 = (qa.ai_score || 0) * 10
                return (
                  <div key={i} className="border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-0.5 rounded-full font-bold">
                            Q{i + 1}
                          </span>
                          {qa.question_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 capitalize">
                              {qa.question_type.replace(/_/g, " ")}
                            </span>
                          )}
                          {qa.is_ai_generated && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-800/50">
                              ⚠️ Possible AI Answer
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm font-medium leading-relaxed">{qa.question}</p>
                      </div>
                      <div className={"text-2xl font-black flex-shrink-0 " + scoreColor(Math.round(s10))}>
                        {Math.round(s10)}%
                      </div>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3 mb-3">
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {qa.answer || "No answer recorded"}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { l: "Technical", v: qa.ai_score },
                        { l: "Relevance", v: qa.relevance_score },
                        { l: "Clarity",   v: qa.clarity_score },
                        { l: "Depth",     v: qa.depth_score }
                      ].map(sc => {
                        const pct = (sc.v || 0) * 10
                        return (
                          <div key={sc.l}>
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>{sc.l}</span>
                              <span>{Math.round(pct)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className={"h-full rounded-full transition-all duration-700 " + barColor(pct)}
                                style={{ width: pct + "%" }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {qa.feedback && (
                      <p className="text-slate-400 text-xs mt-3 italic border-t border-slate-700/50 pt-3">
                        💬 {qa.feedback}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Violation Log */}
        {cheat_logs.length > 0 && (
          <div className="card border-red-900/30">
            <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
              <I name="warning" size={5} /> Violation Log ({cheat_logs.length})
            </h3>
            <div className="space-y-2">
              {cheat_logs.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-red-900/10 border border-red-900/30 rounded-xl">
                  <span className={"text-xs px-2.5 py-1 rounded-full font-medium " + (
                    c.severity === "critical" ? "bg-red-900 text-red-300"
                    : c.severity === "high"   ? "bg-orange-900 text-orange-300"
                    : "bg-yellow-900 text-yellow-300"
                  )}>
                    {c.severity}
                  </span>
                  <span className="text-slate-300 text-sm flex-1">
                    {(c.cheat_type || "").replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-500 text-xs">{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {qa_pairs.length === 0 && !isDisq && (
          <div className="card text-center py-12">
            <I name="doc" size={12} className="text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No answers recorded</h3>
            <p className="text-slate-400 text-sm">
              The interview may have ended before any questions were answered.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
export default Results