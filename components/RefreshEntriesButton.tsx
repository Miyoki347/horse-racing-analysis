'use client'

import { useState } from 'react'

interface Props {
  raceId: string
}

export function RefreshEntriesButton({ raceId }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ updated: number } | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function handleRefresh() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(`/api/refresh-entries/${raceId}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail ?? `${res.status}`)
      setResult(json)
      // ページを再読み込みして最新の出走馬を反映
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? <span className="animate-spin">⟳</span> : '🔄'}
        {loading ? '更新中...' : '出走馬を最新に更新'}
      </button>
      {result && (
        <span className="text-xs text-green-600">✓ {result.updated}頭を更新しました</span>
      )}
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  )
}
