export function formatDate(dateStr) {
  if (!dateStr) return "N/A"
  return new Date(dateStr).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
}
export function formatTime(dateStr) {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}
export function formatDuration(seconds) {
  if (!seconds) return "0m 0s"
  return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s"
}
export function calculateGrade(score) {
  if (score == null) return "N/A"
  if (score >= 90) return "A+"
  if (score >= 80) return "A"
  if (score >= 70) return "B+"
  if (score >= 60) return "B"
  if (score >= 50) return "C"
  return "F"
}
export function truncateText(text, maxLen) {
  if (!text) return ""
  if (!maxLen) maxLen = 100
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + "..."
}
export function getStatusColor(status) {
  var map = { draft:"badge-yellow", topics_review:"badge-blue", approved:"badge-green", active:"badge-green",
    completed:"badge-blue", scheduled:"badge-yellow", in_progress:"badge-green", terminated:"badge-red", disqualified:"badge-red" }
  return map[status] || "badge-blue"
}
export function getInitials(name) {
  if (!name) return "U"
  return name.split(" ").map(function(n){return n[0]}).join("").toUpperCase().slice(0,2)
}
export function getGradeColor(grade) {
  if (!grade) return "text-slate-400"
  if (grade.startsWith("A")) return "text-green-400"
  if (grade.startsWith("B")) return "text-blue-400"
  if (grade === "C") return "text-yellow-400"
  return "text-red-400"
}
export function getScoreColor(score) {
  if (score == null) return "text-slate-400"
  if (score >= 70) return "text-green-400"
  if (score >= 50) return "text-yellow-400"
  return "text-red-400"
}