import { useEffect, useRef } from 'react'

export default function useAssessmentQuestionFocus(currentIndex) {
  const questionRef = useRef(null)
  const previousIndex = useRef(currentIndex)

  useEffect(() => {
    if (previousIndex.current === currentIndex) return
    previousIndex.current = currentIndex
    const question = questionRef.current
    if (!question) return

    question.focus({ preventScroll: true })
    const { top } = question.getBoundingClientRect()
    if (top < 24 || top > window.innerHeight / 2) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      question.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
    }
  }, [currentIndex])

  return questionRef
}
