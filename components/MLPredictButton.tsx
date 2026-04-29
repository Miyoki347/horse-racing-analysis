'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  raceId: string
  hasML:  boolean
}

export function MLPredictButton({ raceId, hasML }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const router = useRouter()

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/predict-ml/${raceId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '予測に失敗しました')
        return
      }
      router.refresh()
    } catch {
      setError('ネットワークエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                   bg-green-600 text-white hover:bg-green-700 active:scale-95 transition-all
                   disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading
          ? <><span className="animate-spin">⟳</span>予測中...</>
          : hasML
            ? '🤖 AI予測を再生成'
            : '🤖 AI予測を生成（LightGBM）'
        }
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
