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

  const [step, setStep]             = useState(1)
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving]   = useState(false)
  const [inviting, setInviting]     = useState(false)
  const [interview, setInterview]   = useState(null)
  const [topics, setTopics]         = useState([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [invitations, setInvitations] = useState([])

  const [form, setForm] = useState({
    title: "", role_name: "", experience_level: "mid",
    duration_minutes: 45, total_questions: 10, job_description: ""
  })

  useEffect(() => { if (isEdit) loadInterview() }, [id])

  const loadInterview = async () => {
    try {
      setLoading(true)
      const res = await interviewService.getInterview(id)
      const iv  = res.data.interview
      setInterview(iv)
      setForm({ title: iv.title, role_name: iv.role_name, experience_level: iv.experience_level,
        duration_minutes: iv.duration_minutes, total_questions: iv.total_questions, job_description: iv.job_description })
      if (iv.topics) setTopics(iv.topics)
      if (iv.status === "topics_review") setStep(2)
      if (iv.status === "active") {
        setStep(3)
        const cRes = await interviewService.getCandidates(id)
        setInvitations(cRes.data.candidates || [])
      }
    } catch { toast.error("Failed to load") }
    finally { setLoading(false) }
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSave = async () => {
    if (!form.title || !form.role_name || !form.job_description) { toast.error("Fill all required fields"); return }
    try {
      setSaving(true)
      if (isEdit) {
        await interviewService.updateInterview(id, form)
        toast.success("Updated!")
      } else {
        const res = await interviewService.createInterview(form)
        setInterview(res.data.interview)
        navigate("/company/setup/" + res.data.interview.id, { replace: true })
        toast.success("Created!")
      }
      setStep(2)
    } catch (e) { toast.error(e.response?.data?.error || "Save failed") }
    finally { setSaving(false) }
  }

  const handleGenerate = async () => {
    const ivId = interview?.id || id
    if (!ivId) { toast.error("Save first"); return }
    try {
      setGenerating(true)
      const res = await interviewService.generateTopics(ivId)
      setTopics(res.data.topics || [])
      toast.success(res.data.topics.length + " topics generated!")
    } catch (e) { toast.error(e.response?.data?.error || "Failed") }
    finally { setGenerating(false) }
  }

  const updateTopic = (i, f, v) => setTopics(p => p.map((t, idx) => idx === i ? { ...t, [f]: v } : t))

  const saveTopics = async () => {
    const total = topics.reduce((s, t) => s + (parseInt(t.weightage) || 0), 0)
    if (total !== 100) { toast.error("Weightages must be 100% (now " + total + "%)"); return }
    try {
      setSaving(true)
      await interviewService.updateTopics(interview?.id || id, topics)
      toast.success("Saved!")
      setStep(3)
    } catch (e) { toast.error(e.response?.data?.error || "Failed") }
    finally { setSaving(false) }
  }

  const handleApprove = async () => {
    try {
      setApproving(true)
      const res = await interviewService.approveInterview(interview?.id || id)
      setInterview(res.data.interview)
      toast.success("Activated!")
      const cRes = await interviewService.getCandidates(interview?.id || id)
      setInvitations(cRes.data.candidates || [])
    } catch (e) { toast.error(e.response?.data?.error || "Failed") }
    finally { setApproving(false) }
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
    } catch (e) { toast.error(e.response?.data?.error || "Failed") }
    finally { setInviting(false) }
  }

  const totalWeight = topics.reduce((s, t) => s + (parseInt(t.weightage) || 0), 0)
  const isActive = interview?.status === "active"

  function stepClass(s) {
    if (step > s) return "bg-green-600 text-white"
    if (step === s) return "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
    return "bg-slate-700 text-slate-400"
  }

  function diffClass(d) {
    if (d === "hard") return "bg-red-900 text-red-300"
    if (d === "medium") return "bg-yellow-900 text-yellow-300"
    return "bg-green-900 text-green-300"
  }

  function statusClass(s) {
    if (s === "completed") return "bg-green-900 text-green-300"
    if (s === "in_progress") return "bg-blue-900 text-blue-300"
    return "bg-yellow-900 text-yellow-300"
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-slate-900 pb-16">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">

        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/company")} className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700">
            <I name="home" size={4} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white">{isEdit ? "Edit Interview" : "Create Interview"}</h1>
            <p className="text-slate-400 text-sm">{interview?.status ? "Status: " + interview.status : "New"}</p>
          </div>
        </div>

        <div className="flex items-center mb-8">
          {[{ n:1, l:"Details", ic:"pencil" }, { n:2, l:"Topics", ic:"robot" }, { n:3, l:"Activate", ic:"rocket" }].map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={"w-10 h-10 rounded-xl flex items-center justify-center " + stepClass(s.n)}>
                  {step > s.n ? <I name="check" size={4} /> : <I name={s.ic} size={4} />}
                </div>
                <span className={"text-sm font-medium hidden md:block " + (step === s.n ? "text-white" : "text-slate-500")}>{s.l}</span>
              </div>
              {i < 2 && <div className={"flex-1 h-0.5 mx-3 " + (step > s.n ? "bg-green-600" : "bg-slate-700")} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="card">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><I name="pencil" className="text-blue-400" /> Job Details</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-slate-300 text-sm font-semibold mb-2">Title *</label>
                  <input type="text" placeholder="e.g. Senior Python Developer" className="input-field" value={form.title} onChange={e => set("title", e.target.value)} /></div>
                <div><label className="block text-slate-300 text-sm font-semibold mb-2">Role *</label>
                  <input type="text" placeholder="e.g. Python Backend Dev" className="input-field" value={form.role_name} onChange={e => set("role_name", e.target.value)} /></div>
              </div>
              <div><label className="block text-slate-300 text-sm font-semibold mb-3">Level</label>
                <div className="grid grid-cols-4 gap-3">
                  {LEVELS.map(l => (
                    <button key={l.value} type="button" onClick={() => set("experience_level", l.value)}
                      className={"p-3 rounded-xl border-2 text-center transition-all " + (form.experience_level === l.value ? "border-blue-500 bg-blue-900/30" : "border-slate-700 bg-slate-700/30")}>
                      <I name={l.icon} size={5} className="mx-auto mb-1 text-slate-400" />
                      <div className="text-white text-xs font-semibold">{l.label}</div>
                      <div className="text-slate-400 text-xs">{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-slate-300 text-sm font-semibold mb-2">Duration (min)</label>
                  <input type="number" min="15" max="120" className="input-field" value={form.duration_minutes} onChange={e => set("duration_minutes", parseInt(e.target.value))} /></div>
                <div><label className="block text-slate-300 text-sm font-semibold mb-2">Questions</label>
                  <input type="number" min="5" max="20" className="input-field" value={form.total_questions} onChange={e => set("total_questions", parseInt(e.target.value))} /></div>
              </div>
              <div><label className="block text-slate-300 text-sm font-semibold mb-2">Job Description *</label>
                <textarea rows={10} placeholder="Paste full JD..." className="input-field resize-none" value={form.job_description} onChange={e => set("job_description", e.target.value)} />
                <p className="text-slate-500 text-xs mt-1">{form.job_description.length} chars</p></div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => navigate("/company")} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary px-8">
                  {saving ? <LoadingSpinner size="sm" text="" /> : <><I name="check" size={4} className="text-white" /> Save and Continue</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div><h2 className="text-xl font-bold text-white flex items-center gap-2"><I name="robot" className="text-blue-400" /> AI Topics</h2>
                <p className="text-slate-400 text-sm mt-1">Review AI-generated topics</p></div>
              <button onClick={handleGenerate} disabled={generating} className="btn-primary">
                {generating ? <><LoadingSpinner size="sm" text="" /> Analyzing...</> : <><I name="lightning" size={4} className="text-white" /> {topics.length > 0 ? "Regenerate" : "Generate"}</>}
              </button>
            </div>
            {topics.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-700 rounded-2xl">
                <I name="robot" size={10} className="mx-auto mb-4 text-slate-600" />
                <h3 className="text-xl font-bold text-white mb-2">No topics yet</h3>
                <p className="text-slate-400">Click Generate to analyze your JD</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {topics.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-slate-700/40 rounded-xl border border-slate-700">
                      <div className="w-8 h-8 bg-blue-600/20 border border-blue-700/50 rounded-lg flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">{i+1}</div>
                      <input type="text" value={t.topic_name} onChange={e => updateTopic(i,"topic_name",e.target.value)} className="flex-1 bg-transparent text-white font-medium outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500 py-0.5 text-sm" />
                      <select value={t.difficulty} onChange={e => updateTopic(i,"difficulty",e.target.value)} className="bg-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 border border-slate-600">
                        <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                      </select>
                      <div className="flex items-center gap-1"><input type="number" min="5" max="60" value={t.weightage} onChange={e => updateTopic(i,"weightage",parseInt(e.target.value)||0)} className="w-14 bg-slate-700 text-white text-center rounded-lg px-2 py-1.5 text-sm border border-slate-600" /><span className="text-slate-400 text-sm">%</span></div>
                    </div>
                  ))}
                </div>
                <div className={"flex items-center justify-between p-3 rounded-xl mb-6 " + (totalWeight===100?"bg-green-900/20 border border-green-800/50":"bg-yellow-900/20 border border-yellow-800/50")}>
                  <span className={totalWeight===100?"text-green-400 text-sm font-medium":"text-yellow-400 text-sm font-medium"}>{totalWeight===100?"Total: 100% - Good!":"Total: "+totalWeight+"% (need 100%)"}</span>
                  {totalWeight !== 100 && <button onClick={() => { const e=Math.floor(100/topics.length); const r=100-e*topics.length; setTopics(p=>p.map((t,i)=>({...t,weightage:i===0?e+r:e}))) }} className="text-yellow-400 hover:text-yellow-300 text-xs underline">Auto-balance</button>}
                </div>
                <div className="flex justify-between gap-3">
                  <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
                  <button onClick={saveTopics} disabled={saving||totalWeight!==100} className="btn-primary px-8">
                    {saving ? <LoadingSpinner size="sm" text="" /> : <><I name="check" size={4} className="text-white" /> Save Topics</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2"><I name="rocket" className="text-green-400" /> Review and Activate</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[{l:"Role",v:form.role_name},{l:"Level",v:form.experience_level},{l:"Duration",v:form.duration_minutes+" min"},{l:"Questions",v:String(form.total_questions)}].map(s=>(
                  <div key={s.l} className="bg-slate-700/50 rounded-xl p-3 text-center"><p className="text-slate-400 text-xs mb-1">{s.l}</p><p className="text-white font-bold capitalize text-sm">{s.v}</p></div>
                ))}
              </div>
              <div className="mb-6"><h3 className="text-slate-300 text-sm font-semibold mb-3">Topics</h3>
                {topics.map((t,i)=>(<div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl mb-2">
                  <div className="flex items-center gap-3"><span className="text-blue-400 text-sm font-bold">{i+1}</span><span className="text-white text-sm">{t.topic_name}</span>
                    <span className={"text-xs px-2 py-0.5 rounded-full "+diffClass(t.difficulty)}>{t.difficulty}</span></div>
                  <span className="text-slate-400 text-sm">{t.weightage}%</span></div>))}
              </div>
              {!isActive ? (
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-secondary">Edit Topics</button>
                  <button onClick={handleApprove} disabled={approving} className="btn-primary flex-1 py-3">
                    {approving ? <><LoadingSpinner size="sm" text="" /> Activating...</> : <><I name="rocket" size={4} className="text-white" /> Activate</>}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/50 rounded-xl">
                  <I name="check" className="text-green-400" /><div><p className="text-green-300 font-semibold">Active!</p><p className="text-slate-400 text-sm">Invite candidates below.</p></div>
                </div>
              )}
            </div>
            {isActive && (
              <div className="card">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><I name="mail" className="text-blue-400" /> Invite Candidates</h3>
                <p className="text-slate-400 text-sm mb-5">Must have a registered candidate account.</p>
                <div className="flex gap-3 mb-4">
                  <input type="email" placeholder="candidate@email.com" className="input-field flex-1" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleInvite() }} />
                  <button onClick={handleInvite} disabled={inviting||!inviteEmail.trim()} className="btn-primary px-6">{inviting ? <LoadingSpinner size="sm" text="" /> : "Invite"}</button>
                </div>
                {invitations.length > 0 && (<div><h4 className="text-slate-400 text-xs font-semibold uppercase mb-3">Invited ({invitations.length})</h4>
                  {invitations.map((inv,i)=>(<div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl mb-2">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{(inv.candidate?.full_name||"U")[0]}</div>
                      <div><p className="text-white text-sm font-medium">{inv.candidate?.full_name}</p><p className="text-slate-400 text-xs">{inv.candidate?.email}</p></div></div>
                    <div className="flex items-center gap-2"><span className={"text-xs px-2 py-1 rounded-full "+statusClass(inv.status)}>{inv.status?.replace("_"," ")}</span>
                      {inv.total_score != null && <span className="text-white text-sm font-bold">{inv.total_score.toFixed(1)}%</span>}</div>
                  </div>))}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
export default InterviewSetup