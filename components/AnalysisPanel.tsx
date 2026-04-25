'use client'
import { useState, useCallback } from 'react'
import type { HorseWithHistory } from '@/types/upcoming'

interface Props {
  raceId: string
  isUpcoming?: boolean
  horses?: HorseWithHistory[]
}

export function AnalysisPanel({ raceId, isUpcoming = false, horses }: Props) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setAnalysis('')
    setError(null)

    try {
      const url = isUpcoming
        ? `/api/predict-upcoming/${raceId}`
        : `/api/predict/${raceId}`

      const res = await fetch(url, {
        method: isUpcoming ? 'POST' : 'GET',
        headers: isUpcoming ? { 'Content-Type': 'application/json' } : undefined,
        body: isUpcoming ? JSON.stringify({ horses }) : undefined,
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAnalysis((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [raceId, isUpcoming, horses])

  return (
    <div className="space-y-4">
      <button
        onClick={generate}
        disabled={loading}
        className="w-full min-h-[44px] px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold
                   hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50
                   disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin text-lg">⟳</span>
            展開予想を生成中...
          </>
        ) : (
          '🤖 展開予想を生成（AI分析）'
        )}
      </button>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {analysis && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 prose prose-sm max-w-none">
          {analysis.split('\n').map((line, i) => {
            if (line.startsWith('## '))  return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-gray-800">{line.slice(3)}</h2>
            if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-gray-700">{line.slice(4)}</h3>
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-gray-800">{line.slice(2, -2)}</p>
            if (line.startsWith('・') || line.startsWith('-')) return <p key={i} className="pl-3 text-gray-700">{line}</p>
            if (line === '') return <br key={i} />
            return <p key={i} className="text-gray-700 leading-relaxed">{line}</p>
          })}
        </div>
      )}
    </div>
  )
}
