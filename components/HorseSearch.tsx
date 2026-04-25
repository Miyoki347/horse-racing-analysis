'use client'
import { useState, useEffect, useRef } from 'react'

interface Horse { id: string; name: string }

interface Props {
  selected: Horse[]
  onChange: (horses: Horse[]) => void
  max?: number
}

export function HorseSearch({ selected, onChange, max = 18 }: Props) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<Horse[]>([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/horses/search?q=${encodeURIComponent(query)}`)
        const data: Horse[] = await res.json()
        // 選択済みを除外
        const selectedIds = new Set(selected.map((s) => s.id))
        setResults(data.filter((d) => !selectedIds.has(d.id)))
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query, selected])

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const add = (horse: Horse) => {
    if (selected.length >= max) return
    onChange([...selected, horse])
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const remove = (id: string) => onChange(selected.filter((h) => h.id !== id))

  return (
    <div className="space-y-3">
      {/* 選択済みタグ */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((h) => (
            <span
              key={h.id}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium"
            >
              {h.name}
              <button
                onClick={() => remove(h.id)}
                className="ml-1 text-indigo-500 hover:text-indigo-800 leading-none"
                aria-label={`${h.name}を削除`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 検索入力 */}
      <div ref={wrapRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selected.length >= max ? `最大${max}頭まで` : '馬名で検索（例：ドウデュース）'}
          disabled={selected.length >= max}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 disabled:bg-gray-100 disabled:text-gray-400"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">検索中...</span>
        )}

        {/* ドロップダウン */}
        {open && results.length > 0 && (
          <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {results.map((h) => (
              <li key={h.id}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); add(h) }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >
                  {h.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && !loading && results.length === 0 && query && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
            「{query}」は見つかりませんでした
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">{selected.length} / {max} 頭選択中</p>
    </div>
  )
}
