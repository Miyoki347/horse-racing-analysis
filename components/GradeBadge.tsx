'use client'
import { GRADE_COLOR } from '@/types/race'

export function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cls = GRADE_COLOR[grade] ?? 'bg-gray-400 text-white'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${cls}`}>
      {grade}
    </span>
  )
}
