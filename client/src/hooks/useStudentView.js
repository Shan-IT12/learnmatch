import { useState } from 'react'
import { readStudentView, saveStudentView } from '../utils/studentPosition'

export default function useStudentView(name, fallback, isValid) {
  const userId = localStorage.getItem('userId')
  const [value, setValue] = useState(() => {
    const saved = readStudentView(localStorage, userId, name, fallback)
    return isValid(saved) ? saved : fallback
  })
  return [value, next => {
    const updated = typeof next === 'function' ? next(value) : next
    setValue(updated)
    if (localStorage.getItem('userId') === userId && isValid(updated)) saveStudentView(localStorage, userId, name, updated)
  }]
}
