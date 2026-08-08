import api from "./api"

export const interviewService = {

  // ── Company ─────────────────────────────────────────────
  getDashboard:      ()         => api.get("/company/dashboard"),
  getInterviews:     ()         => api.get("/company/interviews"),
  getInterview:      (id)       => api.get(`/company/interviews/${id}`),
  createInterview:   (data)     => api.post("/company/interviews", data),
  updateInterview:   (id, data) => api.put(`/company/interviews/${id}`, data),
  deleteInterview:   (id)       => api.delete(`/company/interviews/${id}`),
  generateTopics:    (id)       => api.post(`/company/interviews/${id}/generate-topics`),
  updateTopics:      (id, t)    => api.put(`/company/interviews/${id}/topics`, { topics: t }),
  approveInterview:  (id)       => api.post(`/company/interviews/${id}/approve`),
  inviteCandidate:   (id, email)=> api.post(`/company/interviews/${id}/invite`, { email }),
  getCandidates:     (id)       => api.get(`/company/interviews/${id}/candidates`),
  getRankings:       (id)       => api.get(`/company/interviews/${id}/rankings`),

  // ── Interview Session ────────────────────────────────────
  startSession:      (token)        => api.post("/interview/session/start", { session_token: token }),
  getSession:        (token)        => api.get(`/interview/session/${token}`),
  getNextQuestion:   (token)        => api.get(`/interview/session/${token}/next-question`),
  submitAnswer:      (token, data)  => api.post(`/interview/session/${token}/answer`, data),
  endSession:        (token)        => api.post(`/interview/session/${token}/end`),
  logCheatEvent:     (token, data)  => api.post(`/interview/session/${token}/cheat-event`, data),
  getSessionStatus:  (token)        => api.get(`/interview/session/${token}/status`),

  // ── Candidate ────────────────────────────────────────────
  getCandidateDashboard: ()     => api.get("/candidate/dashboard"),
  getMyInterviews:       ()     => api.get("/candidate/my-interviews"),
  getMyResults:          ()     => api.get("/candidate/my-results"),
  startMock:             (data) => api.post("/candidate/mock/start", data),
  getMockTopics:         ()     => api.get("/candidate/mock/topics"),

  // ── Reports ──────────────────────────────────────────────
  getReport:           (sessionId)   => api.get(`/report/session/${sessionId}`),
  generateReport:      (sessionId)   => api.post(`/report/session/${sessionId}/generate`),
  getInterviewRanking: (interviewId) => api.get(`/report/interview/${interviewId}/ranking`),

  // ── Admin ─────────────────────────────────────────────────
  getAdminStats:      ()             => api.get("/admin/stats"),
  // FIXED: Added ? before role= query parameter
  getAdminUsers:      (role)         => api.get(`/admin/users${role ? "?role=" + role : ""}`),
  toggleUserStatus:   (uid, active)  => api.put(`/admin/users/${uid}/status`, { is_active: active }),
  getAdminInterviews: ()             => api.get("/admin/interviews"),
}