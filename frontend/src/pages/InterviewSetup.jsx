import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { interviewService } from "../services/interviewService"
import LoadingSpinner from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"

const LEVELS = [
  { value: "fresher", label: "Fresher",  desc: "0-1 yr",  icon: "bulb" },
  { value: "junior",  label: "Junior",   desc: "1-3 yrs", icon: "doc" },
  { value: "mid",     label: "Mid",      desc: "3-5 yrs", icon: "lightning" },
  { value: "senior",  label: "Senior",   desc: "5+ yrs",  icon: "trophy" }
]

const InterviewSetup = () => {
  const { id }   = useParams()
  const navigate = useNavigate()
  const isEdit   = Boolean(id)

  const [step,       setStep]       = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genStatus,  setGenStatus]  = useState("")
  const [approving,  setApproving]  = useState(false)
  const [inviting,   setInviting]   = useState(false)
  const [interview,  setInterview]  = useState(null)
  const [topics,     setTopics]     = useState([])
  const [inviteEmail,  setInviteEmail]  = useState("")
  const [invitations,  setInvitations]  = useState([])

  const [form, setForm] = useState({
    title: "", role_name: "", experience_level: "mid",
    duration_minutes: 45, total_questions: 10,
    job_description: ""
  })

  useEffect(() => { if (isEdit) loadInterview() }, [id])

  const loadInterview = async () => {
    try {
      setLoading(true)
      const res = await interviewService.getInterview(id)
      const iv  = res.data.interview
      setInterview(iv)
      setForm({
        title:            iv.title,
        role_name:        iv.role_name,
        experience_level: iv.experience_level,
        duration_minutes: iv.duration_minutes,
        total_questions:  iv.total_questions,
        job_description:  iv.job_description
      })
      if (iv.topics && iv.topics.length > 0) setTopics(iv.topics)
      if (iv.status === "topics_review") setStep(2)
      if (iv.status === "active") {
        setStep(3)
        try {
          const cRes = await interviewService.getCandidates(id)
          setInvitations(cRes.data.candidates || [])
        } catch(e) {}
      }
    } catch (e) {
      toast.error("Failed to load interview")
    } finally {
      setLoading(false)
    }
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSave = async () => {
    if (!form.title || !form.role_name || !form.job_description) {
      toast.error("Fill all required fields")
      return
    }
    try {
      setSaving(true)
      if (isEdit) {
        await interviewService.updateInterview(id, form)
        toast.success("Updated!")
      } else {
        const res = await interviewService.createInterview(form)
        setInterview(res.data.interview)
        const newId = res.data.interview.id
        navigate("/company/setup/" + newId, { replace: true })
        toast.success("Created!")
      }
      setStep(2)
    } catch (e) {
      toast.error(e.response?.data?.error || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    const ivId = interview?.id || id
    if (!ivId) { toast.error("Save interview first"); return }

    try {
      setGenerating(true)
      setGenStatus("Waking up AI server...")

      // Show progressive messages
      const msgTimer1 = setTimeout(() =>
        setGenStatus("Analyzing job description..."), 8000)
      const msgTimer2 = setTimeout(() =>
        setGenStatus("Generating topics with AI... (may take up to 2 min on first call)"), 20000)
      const msgTimer3 = setTimeout(() =>
        setGenStatus("Almost done..."), 60000)

      const res = await interviewService.generateTopics(ivId)

      clearTimeout(msgTimer1)
      clearTimeout(msgTimer2)
      clearTimeout(msgTimer3)

      setTopics(res.data.topics || [])
      setGenStatus("")
      toast.success(res.data.topics.length + " topics generated!")

    } catch (e) {
      setGenStatus("")
      if (e.isTimeout) {
        toast.error(
          "AI is warming up (free server). Please wait 30 seconds and try again.",
          { duration: 8000 }
        )
      } else {
        toast.error(e.response?.data?.error || "Failed to generate topics")
      }
    } finally {
      setGenerating(false)
    }
  }

  const updateTopic = (i, f, v) =>
    setTopics(p => p.map((t, idx) => idx === i ? { ...t, [f]: v } : t))

  const saveTopics = async () => {
    const total = topics.reduce((s, t) => s + (parseInt(t.weightage) || 0), 0)
    if (total !== 100) {
      toast.error("Weightages must total 100% (currently " + total + "%)")
      return
    }
    try {
      setSaving(true)
      await interviewService.updateTopics(interview?.id || id, topics)
      toast.success("Topics saved!")
      setStep(3)
    } catch (e) {
      toast.error(e.response?.data?.error || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    try {
      setApproving(true)
      const res = await interviewService.approveInterview(interview?.id || id)
      setInterview(res.data.interview)
      toast.success("Interview activated!")
      try {
        const cRes = await interviewService.getCandidates(interview?.id || id)
        setInvitations(cRes.data.candidates || [])
      } catch(e) {}
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to activate")
    } finally {
      setApproving(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Enter email"); return }
    try {
      setInviting(true)
      await interviewService.inviteCandidate(interview?.id || id, inviteEmail.trim())
      toast.success("Invited!")
      setInviteEmail("")
      const cRes = await interviewService.getCandidates(interview?.id || id)
      setInvitations(cRes.data.candidates || [])
    } catch (e) {
      toast.error(e.response?.data?.error || "Invite failed")
    } finally {
      setInviting(false)
    }
  }

  const totalWeight = topics.reduce((s, t) => s + (parseInt(t.weightage) || 0), 0)
  const isActive    = interview?.status === "active"

  const stepClass = (s) => {
    if (step > s)  return "bg-green-600 text-white"
    if (step === s) return "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
    return "bg-slate-700 text-slate-400"
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading interview..." />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 pb-16">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/company")}
            className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
            <I name="home" size={4} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white">
              {isEdit ? "Edit Interview" : "Create Interview"}
            </h1>
            <p className="text-slate-400 text-sm">
              {interview?.status ? "Status: " + interview.status : "New interview"}
            </p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center mb-8">
          {[
            { n: 1, l: "Details", ic: "pencil" },
            { n: 2, l: "AI Topics", ic: "robot" },
            { n: 3, l: "Activate", ic: "rocket" }
          ].map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={"w-10 h-10 rounded-xl flex items-center justify-center transition-all " + stepClass(s.n)}>
                  {step > s.n
                    ? <I name="check" size={4} />
                    : <I name={s.ic} size={4} />
                  }
                </div>
                <span className={"text-sm font-medium hidden md:block " + (
                  step === s.n ? "text-white" : "text-slate-500"
                )}>{s.l}</span>
              </div>
              {i < 2 && (
                <div className={"flex-1 h-0.5 mx-3 transition-colors " + (
                  step > s.n ? "bg-green-600" : "bg-slate-700"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Details ── */}
        {step === 1 && (
          <div className="card">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <I name="pencil" className="text-blue-400" /> Job Details
            </h2>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-semibold mb-2">
                    Interview Title *
                  </label>
                  <input type="text" placeholder="e.g. Senior Python Developer Round 1"
                    className="input-field" value={form.title}
                    onChange={e => set("title", e.target.value)} />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-semibold mb-2">
                    Role Name *
                  </label>
                  <input type="text" placeholder="e.g. Python Backend Developer"
                    className="input-field" value={form.role_name}
                    onChange={e => set("role_name", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-3">
                  Experience Level
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {LEVELS.map(l => (
                    <button key={l.value} type="button"
                      onClick={() => set("experience_level", l.value)}
                      className={"p-3 rounded-xl border-2 text-center transition-all " + (
                        form.experience_level === l.value
                          ? "border-blue-500 bg-blue-900/30"
                          : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                      )}>
                      <I name={l.icon} size={5} className="mx-auto mb-1 text-slate-400" />
                      <div className="text-white text-xs font-semibold">{l.label}</div>
                      <div className="text-slate-400 text-xs">{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-semibold mb-2">
                    Duration (minutes)
                  </label>
                  <input type="number" min="15" max="120" className="input-field"
                    value={form.duration_minutes}
                    onChange={e => set("duration_minutes", parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-semibold mb-2">
                    Total Questions
                  </label>
                  <input type="number" min="5" max="20" className="input-field"
                    value={form.total_questions}
                    onChange={e => set("total_questions", parseInt(e.target.value))} />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  Job Description * (paste full JD for best AI results)
                </label>
                <textarea rows={10} placeholder="Paste the complete job description here..."
                  className="input-field resize-none" value={form.job_description}
                  onChange={e => set("job_description", e.target.value)} />
                <p className="text-slate-500 text-xs mt-1">
                  {form.job_description.length} characters
                  {form.job_description.length < 100 &&
                    " · Add more details for better AI topic generation"}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => navigate("/company")} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary px-8">
                  {saving
                    ? <><LoadingSpinner size="sm" text="" /> Saving...</>
                    : <><I name="check" size={4} className="text-white" /> Save & Continue</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: AI Topics ── */}
        {step === 2 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <I name="robot" className="text-blue-400" /> AI-Generated Topics
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  AI analyzes your JD and creates interview topics
                </p>
              </div>
              <button onClick={handleGenerate} disabled={generating}
                className="btn-primary min-w-32">
                {generating
                  ? <><LoadingSpinner size="sm" text="" /> Generating...</>
                  : <><I name="lightning" size={4} className="text-white" />
                    {topics.length > 0 ? "Regenerate" : "Generate"}</>
                }
              </button>
            </div>

            {/* Status message during generation */}
            {generating && genStatus && (
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 mb-4 flex items-center gap-3">
                <LoadingSpinner size="sm" text="" />
                <div>
                  <p className="text-blue-300 text-sm font-medium">{genStatus}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Render free tier may take up to 2 minutes on first call
                  </p>
                </div>
              </div>
            )}

            {/* Info banner about cold starts */}
            {!generating && topics.length === 0 && (
              <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <I name="bulb" size={5} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-300 text-sm font-semibold">
                      First time may be slow
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                      The free server sleeps after 15 minutes of inactivity.
                      First AI call may take <strong className="text-white">30-90 seconds</strong>.
                      Subsequent calls are fast. Please be patient!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {topics.length === 0 && !generating ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-700 rounded-2xl">
                <I name="robot" size={10} className="mx-auto mb-4 text-slate-600" />
                <h3 className="text-xl font-bold text-white mb-2">No topics yet</h3>
                <p className="text-slate-400 mb-4">
                  Click Generate to analyze your job description with AI
                </p>
                <button onClick={handleGenerate} disabled={generating}
                  className="btn-primary">
                  <I name="lightning" size={4} className="text-white" /> Generate Topics
                </button>
              </div>
            ) : topics.length > 0 ? (
              <>
                <div className="space-y-3 mb-6">
                  {topics.map((t, i) => (
                    <div key={i}
                      className="flex items-center gap-3 p-4 bg-slate-700/40 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
                      <div className="w-8 h-8 bg-blue-600/20 border border-blue-700/50 rounded-lg flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <input type="text" value={t.topic_name}
                        onChange={e => updateTopic(i, "topic_name", e.target.value)}
                        className="flex-1 bg-transparent text-white font-medium outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500 py-0.5 text-sm" />
                      <select value={t.difficulty}
                        onChange={e => updateTopic(i, "difficulty", e.target.value)}
                        className="bg-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 border border-slate-600">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" min="5" max="60" value={t.weightage}
                          onChange={e => updateTopic(i, "weightage", parseInt(e.target.value) || 0)}
                          className="w-14 bg-slate-700 text-white text-center rounded-lg px-2 py-1.5 text-sm border border-slate-600" />
                        <span className="text-slate-400 text-sm">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Weight total indicator */}
                <div className={"flex items-center justify-between p-3 rounded-xl mb-6 " + (
                  totalWeight === 100
                    ? "bg-green-900/20 border border-green-800/50"
                    : "bg-yellow-900/20 border border-yellow-800/50"
                )}>
                  <span className={(totalWeight === 100 ? "text-green-400" : "text-yellow-400") + " text-sm font-medium"}>
                    {totalWeight === 100
                      ? "Total: 100% - Ready!"
                      : "Total: " + totalWeight + "% (need exactly 100%)"}
                  </span>
                  {totalWeight !== 100 && (
                    <button onClick={() => {
                      const each = Math.floor(100 / topics.length)
                      const rem  = 100 - each * topics.length
                      setTopics(p => p.map((t, i) => ({
                        ...t, weightage: i === 0 ? each + rem : each
                      })))
                    }} className="text-yellow-400 hover:text-yellow-300 text-xs underline">
                      Auto-balance
                    </button>
                  )}
                </div>

                <div className="flex justify-between gap-3">
                  <button onClick={() => setStep(1)} className="btn-secondary">
                    Back
                  </button>
                  <button onClick={saveTopics}
                    disabled={saving || totalWeight !== 100}
                    className="btn-primary px-8">
                    {saving
                      ? <><LoadingSpinner size="sm" text="" /> Saving...</>
                      : <><I name="check" size={4} className="text-white" /> Save Topics</>
                    }
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── STEP 3: Activate ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <I name="rocket" className="text-green-400" /> Review & Activate
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { l: "Role",       v: form.role_name },
                  { l: "Level",      v: form.experience_level },
                  { l: "Duration",   v: form.duration_minutes + " min" },
                  { l: "Questions",  v: String(form.total_questions) }
                ].map(s => (
                  <div key={s.l} className="bg-slate-700/50 rounded-xl p-3 text-center">
                    <p className="text-slate-400 text-xs mb-1">{s.l}</p>
                    <p className="text-white font-bold capitalize text-sm">{s.v}</p>
                  </div>
                ))}
              </div>

              {topics.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-slate-300 text-sm font-semibold mb-3">Topics</h3>
                  <div className="space-y-2">
                    {topics.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-blue-400 text-sm font-bold">{i + 1}</span>
                          <span className="text-white text-sm">{t.topic_name}</span>
                          <span className={"text-xs px-2 py-0.5 rounded-full " + (
                            t.difficulty === "hard"   ? "bg-red-900 text-red-300" :
                            t.difficulty === "medium" ? "bg-yellow-900 text-yellow-300" :
                            "bg-green-900 text-green-300"
                          )}>{t.difficulty}</span>
                        </div>
                        <span className="text-slate-400 text-sm font-semibold">
                          {t.weightage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isActive ? (
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-secondary">
                    Edit Topics
                  </button>
                  <button onClick={handleApprove} disabled={approving}
                    className="btn-primary flex-1 py-3">
                    {approving
                      ? <><LoadingSpinner size="sm" text="" /> Activating...</>
                      : <><I name="rocket" size={4} className="text-white" /> Activate Interview</>
                    }
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/50 rounded-xl">
                  <I name="check" className="text-green-400" />
                  <div>
                    <p className="text-green-300 font-semibold">Interview Active!</p>
                    <p className="text-slate-400 text-sm">Invite candidates below.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Invite candidates */}
            {isActive && (
              <div className="card">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <I name="mail" className="text-blue-400" /> Invite Candidates
                </h3>
                <p className="text-slate-400 text-sm mb-5">
                  Candidate must have a registered account on InterviewAI.
                </p>
                <div className="flex gap-3 mb-4">
                  <input type="email" placeholder="candidate@email.com"
                    className="input-field flex-1"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleInvite() }} />
                  <button onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="btn-primary px-6">
                    {inviting ? <LoadingSpinner size="sm" text="" /> : "Invite"}
                  </button>
                </div>

                {invitations.length > 0 && (
                  <div>
                    <h4 className="text-slate-400 text-xs font-semibold uppercase mb-3">
                      Invited ({invitations.length})
                    </h4>
                    <div className="space-y-2">
                      {invitations.map((inv, i) => (
                        <div key={i}
                          className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                              {(inv.candidate?.full_name || "U")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">
                                {inv.candidate?.full_name}
                              </p>
                              <p className="text-slate-400 text-xs">{inv.candidate?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={"text-xs px-2 py-1 rounded-full " + (
                              inv.status === "completed"   ? "bg-green-900 text-green-300" :
                              inv.status === "in_progress" ? "bg-blue-900 text-blue-300" :
                              "bg-yellow-900 text-yellow-300"
                            )}>
                              {inv.status?.replace("_", " ")}
                            </span>
                            {inv.total_score != null && (
                              <span className="text-white text-sm font-bold">
                                {inv.total_score.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
export default InterviewSetup