import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { interviewService } from "../services/interviewService"
import { stopAllMedia } from "../utils/cameraUtils"
import { SOCKET_URL, BACKEND_URL } from "../services/api"
import AIAvatar       from "../components/interview/AIAvatar"
import ChatPanel      from "../components/interview/ChatPanel"
import VideoPanel     from "../components/interview/VideoPanel"
import TimerBar       from "../components/interview/TimerBar"
import SpeechInput    from "../components/interview/SpeechInput"
import CheatAlert     from "../components/interview/CheatAlert"
import LoadingSpinner from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"
import { io } from "socket.io-client"

const PHASE = {
  SETUP:     "setup",
  READY:     "ready",
  INTERVIEW: "interview",
  DONE:      "done"
}

const InterviewRoom = () => {
  const { token }  = useParams()
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const jwtToken   = localStorage.getItem("access_token")

  // ── Core state ──────────────────────────────────────────
  const [phase,       setPhase]       = useState(PHASE.SETUP)
  const [session,     setSession]     = useState(null)
  const [interview,   setInterview]   = useState(null)
  const [messages,    setMessages]    = useState([])
  const [currentQ,    setCurrentQ]    = useState(null)
  const [questionId,  setQuestionId]  = useState(null)
  const [qNumber,     setQNumber]     = useState(0)
  const [totalQ,      setTotalQ]      = useState(10)
  const [cheatEvents, setCheatEvents] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState("")
  const [terminated,  setTerminated]  = useState(false)
  const [resultSid,   setResultSid]   = useState(null)

  // ── UI state - CRITICAL: these control input visibility ──
  const [isThinking,   setIsThinking]   = useState(false)
  const [isSpeaking,   setIsSpeaking]   = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingEnd,   setPendingEnd]   = useState(false)
  const [connected,    setConnected]    = useState(false)
  const [inputReady,   setInputReady]   = useState(false) // NEW: explicit input gate

  const socketRef  = useRef(null)
  const endingRef  = useRef(false)
  const phaseRef   = useRef(phase)
  phaseRef.current = phase

  // ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      stopAllMedia()
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  // ── Load session ─────────────────────────────────────────
  useEffect(() => { loadSession() }, [])

  const loadSession = async () => {
    try {
      setLoading(true)
      setError("")
      if (!token || token.length < 10) {
        setError("Invalid session link. Please go back to dashboard.")
        return
      }
      const res  = await interviewService.getSession(token)
      const sess = res.data.session
      const iv   = res.data.interview
      setSession(sess)
      setInterview(iv)
      setTotalQ(iv?.total_questions || 10)
      if (sess.status === "completed") {
        navigate("/results/" + sess.id, { replace: true })
        return
      }
      if (sess.status === "disqualified") {
        setError("Disqualified: " + (sess.disqualification_reason || "violations"))
        return
      }
      setPhase(PHASE.READY)
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
        setError("Session not found. Please go back to dashboard and start a new interview.")
      } else if (status === 403) {
        setError("Access denied. Please login with the correct account.")
      } else {
        setError(err.response?.data?.error || "Failed to load session.")
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Cheat detection ──────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.INTERVIEW) return
    const lastFired = {}
    const cooldown  = (key, ms = 10000) => {
      const now = Date.now()
      if (now - (lastFired[key] || 0) < ms) return false
      lastFired[key] = now
      return true
    }
    const onBlur = () => {
      if (!cooldown("blur")) return
      addCheat({ type: "tab_switch", severity: "high", description: "Window lost focus" })
      toast.error("Warning: Stay on this window!", { duration: 3000 })
    }
    const onVis  = () => {
      if (document.hidden && cooldown("vis"))
        addCheat({ type: "tab_switch", severity: "high", description: "Tab hidden" })
    }
    const onPaste = () => {
      if (!cooldown("paste", 15000))
        addCheat({ type: "copy_paste", severity: "medium", description: "Paste detected" })
    }
    const onMenu = (e) => e.preventDefault()

    window.addEventListener("blur",               onBlur)
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("paste",              onPaste)
    document.addEventListener("contextmenu",      onMenu)
    return () => {
      window.removeEventListener("blur",               onBlur)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("paste",              onPaste)
      document.removeEventListener("contextmenu",      onMenu)
    }
  }, [phase])

  // ── Socket ───────────────────────────────────────────────
  const connectSocket = useCallback(() => {
    if (socketRef.current) socketRef.current.disconnect()
    const isLocal = window.location.hostname === "localhost"
    const sock = io(SOCKET_URL, {
      auth:         { token: jwtToken },
      transports:   isLocal ? ["websocket"] : ["polling", "websocket"],
      reconnection: true,
      timeout:      20000
    })
    sock.on("connect",    () => setConnected(true))
    sock.on("disconnect", () => setConnected(false))
    sock.on("session_warning",    (d) => toast.error(d.message || "Warning", { duration: 5000 }))
    sock.on("session_terminated", (d) => {
      toast.error("Terminated: " + (d.reason || "violations"), { duration: 8000 })
      setTerminated(true)
      setPhase(PHASE.DONE)
      stopAllMedia()
    })
    socketRef.current = sock
  }, [token, jwtToken])

  // ── Helpers ──────────────────────────────────────────────
  const addMsg = useCallback((role, content) => {
    setMessages(prev => [...prev, {
      role, content, timestamp: new Date().toISOString()
    }])
  }, [])

  const addCheat = useCallback((event) => {
    const cheatType   = String(event?.type || "unknown")
    const severity    = String(event?.severity || "medium")
    const description = String(event?.description || "")
    setCheatEvents(prev => [...prev, { type: cheatType, severity, description }])
    if (socketRef.current) {
      socketRef.current.emit("cheat_detected", {
        token: jwtToken, session_token: token,
        cheat_type: cheatType, severity, description
      })
    }
  }, [jwtToken, token])

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text) return
    window.speechSynthesis.cancel()
    const utt  = new SpeechSynthesisUtterance(text)
    utt.rate   = 0.92
    utt.pitch  = 1.0
    utt.volume = 1.0
    const voices = window.speechSynthesis.getVoices()
    const pref   = voices.find(v => v.lang === "en-US" && v.name.includes("Google"))
    if (pref) utt.voice = pref
    utt.onstart = () => setIsSpeaking(true)
    utt.onend   = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utt)
  }, [])

  // ── Start interview ──────────────────────────────────────
  const startInterview = async () => {
    try {
      setLoading(true)
      await interviewService.startSession(token)
      connectSocket()
      try {
        await document.documentElement.requestFullscreen().catch(() => {})
      } catch(e) {}
      setPhase(PHASE.INTERVIEW)
      // Fetch first question
      await fetchQuestion()
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start")
    } finally {
      setLoading(false)
    }
  }

  // ── Fetch question - THE KEY FUNCTION ───────────────────
  const fetchQuestion = async (retryCount = 0) => {
    // CRITICAL: Reset ALL blocking states before fetching
    setIsSubmitting(false)
    setInputReady(false)
    setIsThinking(true)
    setCurrentQ(null)

    await new Promise(r => setTimeout(r, 300))

    try {
      const res = await interviewService.getNextQuestion(token)

      if (res.data.complete) {
        await endInterview()
        return
      }

      const q = res.data.question
      if (!q) {
        throw new Error("No question received")
      }

      // Set question data
      setCurrentQ(q)
      setQuestionId(q.id)
      setQNumber(res.data.question_number || 0)

      // Add to chat
      if (q.question_text) {
        addMsg("ai", q.question_text)
        setTimeout(() => speak(q.question_text), 400)
      }

      // ⚡ CRITICAL: Set thinking FALSE and inputReady TRUE
      // This is what shows the input box
      setIsThinking(false)
      setInputReady(true)

    } catch (err) {
      console.warn("[Interview] Question error:", err.message)

      if (retryCount < 2) {
        // Auto retry
        addMsg("ai", retryCount === 0
          ? "Let me think of the next question for you..."
          : "Almost there, one moment..."
        )
        await new Promise(r => setTimeout(r, 4000))
        if (phaseRef.current === PHASE.INTERVIEW) {
          await fetchQuestion(retryCount + 1)
        }
      } else {
        // Show fallback - still allow interview to continue
        const fallback = _getFallbackQuestion(qNumber)
        setCurrentQ({
          id:            null,
          question_text: fallback,
          question_type: "technical",
          difficulty:    "medium",
          order_index:   qNumber
        })
        setQuestionId(null)
        addMsg("ai", fallback)
        setTimeout(() => speak(fallback), 400)
        setIsThinking(false)
        setInputReady(true) // Show input even with fallback
        toast.error("Using cached question. AI will be ready soon.", { duration: 3000 })
      }
    }
  }

  const _getFallbackQuestion = (qNum) => {
    const questions = [
      "Could you please introduce yourself and tell me about your background?",
      "Can you tell me about your most recent project and your role in it?",
      "What technologies and programming languages are you most comfortable with?",
      "Describe a challenging technical problem you solved. What was your approach?",
      "How do you ensure code quality in your projects?",
      "Tell me about a time you had to learn a new technology quickly.",
      "How do you approach debugging a complex issue?",
      "What are your career goals for the next 2-3 years?",
      "Do you have any questions for us about the role or the team?"
    ]
    return questions[qNum % questions.length]
  }

  // ── Submit answer ────────────────────────────────────────
  const handleSubmit = async (answerText, duration) => {
    if (!answerText?.trim()) return
    if (isSubmitting || pendingEnd) return
    // questionId can be null for fallback questions - that's OK

    try {
      setIsSubmitting(true)
      setInputReady(false) // Hide input while submitting
      addMsg("candidate", answerText)
      window.speechSynthesis?.cancel()
      setIsSpeaking(false)

      // Submit to backend (if we have a real question ID)
      if (questionId) {
        try {
          await interviewService.submitAnswer(token, {
            answer_text:      answerText,
            question_id:      questionId,
            duration_seconds: duration || 30
          })
        } catch (e) {
          console.warn("[Interview] Submit error:", e.message)
          // Continue even if submit fails
        }
      }

      await new Promise(r => setTimeout(r, 500))

      // Check if closing question
      if (currentQ?.question_type === "closing") {
        await handleClosing(answerText)
      } else {
        // CRITICAL: Reset submitting BEFORE fetching next question
        setIsSubmitting(false)
        await fetchQuestion()
      }
    } catch (err) {
      console.error("[Interview] Submit error:", err)
      setIsSubmitting(false)
      setInputReady(true) // Re-show input on error
      toast.error("Failed to submit answer. Please try again.")
    }
  }

  // ── Handle closing question ──────────────────────────────
  const handleClosing = async (answerText) => {
    const lower = answerText.toLowerCase()
    const noQ   = ["no question","no questions","nothing","i'm good",
      "that's all","thank you","thanks","nope","none","no"
    ].some(p => lower.includes(p))

    if (noQ) {
      addMsg("ai", "Thank you so much for your time today! It was great speaking with you. Your results will be ready shortly. Good luck!")
      speak("Thank you! Your results are being processed.")
      setPendingEnd(true)
      setIsSubmitting(false)
      setTimeout(() => endInterview(), 3500)
    } else {
      setIsThinking(true)
      try {
        const resp = await fetch(
          BACKEND_URL + "/api/interview/session/" + token + "/ai-respond",
          {
            method:  "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": "Bearer " + jwtToken
            },
            body: JSON.stringify({ question: answerText })
          }
        )
        const data = await resp.json()
        if (data.response) {
          addMsg("ai", data.response)
          speak(data.response)
        }
        await new Promise(r => setTimeout(r, 3000))
        addMsg("ai", "Thank you for those questions! Your interview is now complete. Best of luck!")
        speak("Thank you! Interview complete.")
        setPendingEnd(true)
        setIsSubmitting(false)
        setTimeout(() => endInterview(), 4000)
      } catch(e) {
        addMsg("ai", "Thank you! Your interview is complete. Best of luck!")
        setPendingEnd(true)
        setIsSubmitting(false)
        setTimeout(() => endInterview(), 3000)
      } finally {
        setIsThinking(false)
      }
    }
  }

  // ── End interview ────────────────────────────────────────
  const endInterview = async () => {
    if (endingRef.current) return
    endingRef.current = true
    try {
      stopAllMedia()
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      const res = await interviewService.endSession(token)
      const sid = res.data.session_id
      setResultSid(sid)
      addMsg("ai", "Interview complete! Redirecting to your results...")
      setPhase(PHASE.DONE)
      setTimeout(() => navigate("/results/" + sid), 2500)
    } catch (err) {
      const sid = session?.id
      setPhase(PHASE.DONE)
      if (sid) setTimeout(() => navigate("/results/" + sid), 2000)
      else navigate("/candidate")
    }
  }

  const handleTimeUp = () => {
    toast.error("Time is up!")
    endInterview()
  }

  const safeNavigate = (path) => {
    stopAllMedia()
    navigate(path)
  }

  // ── Render gates ─────────────────────────────────────────

  // Show input when: in interview, question loaded, not submitting, not ending
  const showInput = (
    phase === PHASE.INTERVIEW &&
    !pendingEnd &&
    currentQ !== null &&
    inputReady &&
    !isSubmitting
  )

  // Show loading when: thinking or submitting (but question not ready)
  const showLoading = (
    phase === PHASE.INTERVIEW &&
    !pendingEnd &&
    (isThinking || isSubmitting || !inputReady)
  )

  // ── LOADING ──────────────────────────────────────────────
  if (loading && phase === PHASE.SETUP) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading your interview..." />
    </div>
  )

  // ── ERROR ────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="card text-center max-w-md">
        <I name="warning" size={12} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-3">Session Error</h2>
        <p className="text-slate-300 mb-6 text-sm leading-relaxed">{error}</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => { setError(""); loadSession() }} className="btn-secondary w-full">
            Try Again
          </button>
          <button onClick={() => safeNavigate("/candidate")} className="btn-primary w-full">
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )

  // ── READY ────────────────────────────────────────────────
  if (phase === PHASE.READY) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-4">
        <div className="card text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <I name="robot" size={8} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{interview?.title || "Interview"}</h1>
          <p className="text-slate-400 mt-1">
            <span className="text-blue-400 font-semibold">{interview?.role_name}</span>
            {" · "}
            <span className="text-blue-400 font-semibold capitalize">{interview?.experience_level}</span>
          </p>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { icon: "clock",    label: "Duration",   value: (interview?.duration_minutes || 45) + " min" },
              { icon: "question", label: "Questions",  value: String(interview?.total_questions || 10) },
              { icon: "shield",   label: "Anti-Cheat", value: "Active" }
            ].map(s => (
              <div key={s.label} className="bg-slate-700/50 rounded-xl p-3 text-center">
                <I name={s.icon} size={5} className="mx-auto mb-1 text-slate-400" />
                <p className="text-slate-400 text-xs">{s.label}</p>
                <p className="text-white font-semibold text-sm">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
            <I name="camera" size={4} className="text-blue-400" /> Camera Check
          </p>
          <VideoPanel onStreamReady={() => {}} onError={() => {}} isActive={false} compact={true} />
        </div>
        <div className="card">
          <p className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
            <I name="doc" size={4} className="text-yellow-400" /> Rules
          </p>
          <div className="space-y-2">
            {[
              "Keep your face clearly visible in camera at all times",
              "Do not switch browser tabs or minimize the window",
              "Do not copy-paste answers from external sources",
              "Speak clearly if using voice input"
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <I name="check" size={3} className="text-green-400 flex-shrink-0 mt-0.5" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={startInterview} disabled={loading} className="btn-primary w-full py-4 text-lg">
          {loading
            ? <><LoadingSpinner size="sm" text="" /> Starting...</>
            : <><I name="rocket" size={5} className="text-white" /> Begin Interview</>
          }
        </button>
      </div>
    </div>
  )

  // ── DONE ─────────────────────────────────────────────────
  if (phase === PHASE.DONE) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="card text-center max-w-md w-full">
        {terminated ? (
          <>
            <I name="warning" size={12} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-400 mb-3">Terminated</h2>
            <p className="text-slate-400 mb-6 text-sm">Too many violations detected.</p>
          </>
        ) : (
          <>
            <I name="trophy" size={12} className="text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">Interview Complete!</h2>
            <p className="text-slate-400 mb-4 text-sm">AI is evaluating your responses...</p>
            <LoadingSpinner size="sm" text="Redirecting to results..." />
          </>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => safeNavigate("/candidate")} className="btn-secondary flex-1">
            Dashboard
          </button>
          {resultSid && (
            <button onClick={() => safeNavigate("/results/" + resultSid)} className="btn-primary flex-1">
              View Results
            </button>
          )}
        </div>
      </div>
    </div>
  )

  // ── INTERVIEW ROOM ───────────────────────────────────────
  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <CheatAlert events={cheatEvents} />

      {/* Top bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-sm font-bold hidden md:block truncate max-w-36">
            {interview?.role_name || "Interview"}
          </span>
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex-1 max-w-sm mx-auto">
          <TimerBar
            durationMinutes={interview?.duration_minutes || 45}
            onTimeUp={handleTimeUp}
            isActive={phase === PHASE.INTERVIEW}
          />
        </div>
        <div className="bg-slate-700 rounded-lg px-3 py-1 text-white text-sm font-bold flex-shrink-0">
          {qNumber} / {totalQ}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <div className="w-48 xl:w-56 flex-shrink-0 bg-slate-800/50 border-r border-slate-700 p-3 flex flex-col gap-3 overflow-y-auto">
          <AIAvatar isSpeaking={isSpeaking} isThinking={isThinking} />
          <VideoPanel
            onStreamReady={() => {}}
            onError={() => {}}
            onCheat={addCheat}
            isActive={phase === PHASE.INTERVIEW}
            compact={true}
          />
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Progress</span>
              <span>{Math.round((qNumber / totalQ) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700"
                style={{ width: Math.round((qNumber / totalQ) * 100) + "%" }}
              />
            </div>
          </div>
          {cheatEvents.length > 0 && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3">
              <p className="text-red-400 text-xs font-semibold mb-1">
                Violations: {cheatEvents.length}
              </p>
              {cheatEvents.slice(-2).map((e, i) => (
                <p key={i} className="text-red-400/60 text-xs truncate">
                  {String(e?.type || "").replace(/_/g, " ")}
                </p>
              ))}
            </div>
          )}
          <div className="bg-slate-700/20 rounded-xl p-3">
            <p className="text-slate-400 text-xs font-semibold mb-2">Tips</p>
            <ul className="space-y-1 text-slate-500 text-xs">
              <li>• Use specific examples</li>
              <li>• STAR method works</li>
              <li>• Be concise and clear</li>
            </ul>
          </div>
        </div>

        {/* Center: Chat + Input */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden">
            <ChatPanel messages={messages} isThinking={isThinking && !currentQ} />
          </div>

          {/* ⚡ INPUT AREA - controlled by showInput / showLoading */}
          <div className="border-t border-slate-700 bg-slate-800/50 p-4 flex-shrink-0 min-h-[100px]">

            {pendingEnd && (
              <div className="flex items-center justify-center gap-3 py-3 text-slate-400">
                <LoadingSpinner size="sm" text="" />
                <span className="text-sm">Wrapping up your interview...</span>
              </div>
            )}

            {!pendingEnd && showInput && (
              <SpeechInput
                key={questionId || qNumber} // Force re-mount on new question
                onSubmit={handleSubmit}
                disabled={false}
                placeholder={
                  currentQ?.question_type === "closing"
                    ? "Ask a question, or say: No questions, thank you"
                    : "Speak or type your answer... (Ctrl+Enter to submit)"
                }
              />
            )}

            {!pendingEnd && showLoading && (
              <div className="flex items-center justify-center gap-3 py-3 text-slate-400">
                <LoadingSpinner size="sm" text="" />
                <span className="text-sm">
                  {isSubmitting
                    ? "Submitting your answer..."
                    : "Alex is preparing the next question..."}
                </span>
              </div>
            )}

          </div>
        </div>

        {/* Right panel */}
        <div className="w-48 xl:w-56 flex-shrink-0 bg-slate-800/50 border-l border-slate-700 p-4 overflow-y-auto hidden lg:block">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Current Question
          </h3>
          {currentQ ? (
            <div className="space-y-3">
              <div className="bg-slate-700/40 border border-slate-700 rounded-xl p-3">
                <p className="text-white text-xs leading-relaxed">{currentQ.question_text}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (
                  currentQ.difficulty === "hard"   ? "bg-red-900 text-red-300" :
                  currentQ.difficulty === "medium" ? "bg-yellow-900 text-yellow-300" :
                  "bg-green-900 text-green-300"
                )}>{currentQ.difficulty}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300 capitalize">
                  {(currentQ.question_type || "").replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-700/30 rounded-xl p-3">
              <p className="text-slate-500 text-xs">
                {isThinking ? "Generating..." : "Waiting..."}
              </p>
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Info</h3>
            <div className="space-y-2 text-xs">
              {[
                { l: "Role",       v: interview?.role_name },
                { l: "Level",      v: interview?.experience_level },
                { l: "Answered",   v: Math.max(0, qNumber - 1) + " / " + totalQ },
                { l: "Violations", v: String(cheatEvents.length) }
              ].map(s => (
                <div key={s.l} className="flex justify-between">
                  <span className="text-slate-500">{s.l}</span>
                  <span className={
                    s.l === "Violations" && cheatEvents.length > 0
                      ? "text-red-400 font-semibold"
                      : "text-slate-300"
                  }>{s.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => {
                if (window.confirm("End interview early? Progress will be saved.")) {
                  endInterview()
                }
              }}
              className="w-full text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-800 bg-red-900/10 hover:bg-red-900/20 rounded-xl py-2 transition-all"
            >
              End Interview Early
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InterviewRoom