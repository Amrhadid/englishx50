import { useSearchParams } from 'react-router-dom'
import SpeakingTask from '../components/SpeakingTask'

const DEFAULT_QUESTION =
  'Talk about your daily routine and how you stay healthy. Form at least 3 complete sentences.'

export default function Speaking() {
  const [params] = useSearchParams()
  const question = params.get('q') || DEFAULT_QUESTION
  const num = params.get('n')

  let student: string | undefined
  try {
    student = localStorage.getItem('x50_user') ?? undefined
  } catch {
    student = undefined
  }

  return (
    <div className="min-h-screen bg-[#fdfcff]">
      <SpeakingTask
        question={question}
        challengeNumber={num ? Number(num) : undefined}
        student={student}
      />
    </div>
  )
}
