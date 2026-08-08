export const API_BASE = "http://localhost:5000/api"
export const SOCKET_URL = "http://localhost:5000"

export const ROLES = {
  ADMIN: "admin",
  COMPANY: "company",
  CANDIDATE: "candidate"
}

export const INTERVIEW_STATUS = {
  DRAFT: "draft",
  TOPICS_REVIEW: "topics_review",
  APPROVED: "approved",
  ACTIVE: "active",
  COMPLETED: "completed"
}

export const SESSION_STATUS = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  TERMINATED: "terminated",
  DISQUALIFIED: "disqualified"
}

export const CHEAT_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical"
}

export const EXPERIENCE_LEVELS = [
  { value: "fresher", label: "Fresher (0-1 yr)" },
  { value: "junior",  label: "Junior (1-3 yrs)" },
  { value: "mid",     label: "Mid (3-5 yrs)" },
  { value: "senior",  label: "Senior (5+ yrs)" }
]

export const GRADE_COLORS = {
  "A+": "text-green-400",
  "A":  "text-green-400",
  "B+": "text-blue-400",
  "B":  "text-blue-400",
  "C":  "text-yellow-400",
  "F":  "text-red-400"
}