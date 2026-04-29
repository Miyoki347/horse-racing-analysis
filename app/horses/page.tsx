'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/components/SiteHeader'

interface Horse {
  id: string
  name: string
}

export default function HorsesPage() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Horse[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/horses/search?q=${encodeURIComponent(query)}`)
        const data: Horse[] = await res.json()
        setResults(data)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <SiteHeader active="horses" />

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">馬検索</h2>
          <p className="text-sm text-gray-500">馬名を入力してプロファイルを確認できます</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="馬名で検索（例：ドウデュース）"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400"
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">
                検索中...
              </span>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {results.map((horse) => (
              <button
                key={horse.id}
                onClick={() => router.push(`/horse/${encodeURIComponent(horse.name)}`)}
                className="w-full text-left px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-sm font-medium text-gray-800"
              >
                {horse.name}
              </button>
            ))}
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">🔍</p>
            <p>「{query}」は見つかりませんでした</p>
          </div>
        )}

        {!query && (
          <div className="text-center py-16 text-gray-300">
            <p className="text-4xl mb-4">🐴</p>
            <p className="text-sm">馬名を入力してください</p>
          </div>
        )}
      </div>
    </main>
  )
}
