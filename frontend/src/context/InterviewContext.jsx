import { createContext, useContext, useState } from "react"

const InterviewContext = createContext(null)

export const InterviewProvider = ({ children }) => {
  const [currentSession, setCurrentSession] = useState(null)
  const [interviewData,  setInterviewData]  = useState(null)
  const [isActive,       setIsActive]       = useState(false)

  const startInterview = (session, interview) => {
    setCurrentSession(session)
    setInterviewData(interview)
    setIsActive(true)
  }

  const endInterview = () => {
    setCurrentSession(null)
    setInterviewData(null)
    setIsActive(false)
  }

  return (
    <InterviewContext.Provider value={{
      currentSession, interviewData, isActive,
      startInterview, endInterview,
      setCurrentSession, setInterviewData
    }}>
      {children}
    </InterviewContext.Provider>
  )
}

export const useInterview = () => {
  const ctx = useContext(InterviewContext)
  if (!ctx) throw new Error("useInterview must be used within InterviewProvider")
  return ctx
}

export default InterviewContext