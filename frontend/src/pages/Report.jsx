import { useParams, useNavigate } from "react-router-dom"
import { useEffect } from "react"

// Report page just redirects to Results
const Report = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    navigate(`/results/${sessionId}`, { replace: true })
  }, [sessionId])
  return null
}
export default Report