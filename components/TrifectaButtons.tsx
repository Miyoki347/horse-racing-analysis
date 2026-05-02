'use client'

import { useState, useCallback } from 'react'
import type { HorseWithHistory } from '@/types/upcoming'

interface Props {
  raceId: string
  horses: HorseWithHistory[]
}

type BetType = 'sanrentan' | 'sanrenpuku'

interface ParsedHorse { name: string; reason: string }

function parseSanrentan(text: string): { picks: (ParsedHorse & { rank: number })[]; rest: string } {
  const m = text.match(/\[SANRENTAN\]([\s\S]*?)\[\/SANRENTAN\]/)
  if (!m) return { picks: [], rest: text }
  const picks = m[1].trim().split('\n').filter(Boolean).map(line => {
    const [rank, name, reason] = line.split('|')
    return { rank: parseInt(rank ?? '0'), name: (name ?? '').trim(), reason: (reason ?? '').trim() }
  }).filter(p => p.name && !isNaN(p.rank))
  const rest = text.replace(/\[SANRENTAN\][\s\S]*?\[\/SANRENTAN\]\n?/, '').trim()
  return { picks, rest }
}

function parseSanrenpuku(text: string): { picks: ParsedHorse[]; rest: string } {
  const m = text.match(/\[SANRENPUKU\]([\s\S]*?)\[\/SANRENPUKU\]/)
  if (!m) return { picks: [], rest: text }
  const picks = m[1].trim().split('\n').filter(Boolean).map(line => {
    const [name, reason] = line.split('|')
    return { name: (name ?? '').trim(), reason: (reason ?? '').trim() }
  }).filter(p => p.name)
  const rest = text.replace(/\[SANRENPUKU\][\s\S]*?\[\/SANRENPUKU\]\n?/, '').trim()
  return { picks, rest }
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## '))  return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-gray-800">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-indigo-700">{line.slice(4)}</h3>
    if (line.startsWith('* ') || line.startsWith('- ')) return <p key={i} className="pl-3 text-gray-700 text-sm">・{line.slice(2)}</p>
    if (line === '') return <br key={i} />
    return <p key={i} className="text-gray-700 text-sm leading-relaxed">{line}</p>
  })
}

const RANK_STYLES = [
  { label: '1着', bg: 'bg-yellow-50', border: 'border-yellow-400', badge: 'bg-yellow-400 text-yellow-900', icon: '🥇' },
  { label: '2着', bg: 'bg-gray-50',   border: 'border-gray-300',   badge: 'bg-gray-400 text-white',        icon: '🥈' },
  { label: '3着', bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-600 text-white',       icon: '🥉' },
]

export function TrifectaButtons({ raceId, horses }: Props) {
  const [activeType, setActiveType]   = useState<BetType | null>(null)
  const [loading, setLoading]         = useState(false)
  const [rawText, setRawText]         = useState('')
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const generate = useCallback(async (type: BetType) => {
    setActiveType(type)
    setLoading(true)
    setRawText('')
    setDone(false)
    setError(null)

    try {
      const res = await fetch(`/api/trifecta-predict/${raceId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ horses, type }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done: d, value } = await reader.read()
        if (d) break
        setRawText(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setLoading(false)
      setDone(true)
    }
  }, [raceId, horses])

  const tanParsed  = activeType === 'sanrentan'  && done ? parseSanrentan(rawText)  : null
  const pukuParsed = activeType === 'sanrenpuku' && done ? parseSanrenpuku(rawText) : null

  const previewText = rawText
    .replace(/\[SANRENTAN\][\s\S]*?\[\/SANRENTAN\]\n?/, '')
    .replace(/\[SANRENPUKU\][\s\S]*?\[\/SANRENPUKU\]\n?/, '')
    .trim()

  return (
    <div className="space-y-4">
      {/* ボタン行 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => generate('sanrentan')}
          disabled={loading}
          className={`min-h-[48px] rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5
            ${activeType === 'sanrentan' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-2 border-indigo-300 hover:border-indigo-500'}`}
        >
          {loading && activeType === 'sanrentan'
            ? <><span className="animate-spin">⟳</span>生成中...</>
            : '🎯 3連単予想'}
        </button>
        <button
          onClick={() => generate('sanrenpuku')}
          disabled={loading}
          className={`min-h-[48px] rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5
            ${activeType === 'sanrenpuku' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border-2 border-purple-300 hover:border-purple-500'}`}
        >
          {loading && activeType === 'sanrenpuku'
            ? <><span className="animate-spin">⟳</span>生成中...</>
            : '🎲 3連複予想'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* 生成中プレビュー */}
      {loading && previewText && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 text-sm animate-pulse whitespace-pre-wrap">
          {previewText}
        </div>
      )}

      {/* 3連単結果 */}
      {tanParsed && tanParsed.picks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {tanParsed.picks.slice(0, 3).map((pick, i) => {
              const s = RANK_STYLES[i]
              return (
                <div key={i} className="contents">
                  <div className={`flex-1 rounded-xl border-2 p-3 text-center ${s.bg} ${s.border}`}>
                    <span className="text-xl">{s.icon}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 leading-tight">{pick.name}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{pick.reason}</p>
                  </div>
                  {i < 2 && <span className="text-gray-400 text-lg flex-shrink-0">→</span>}
                </div>
              )
            })}
          </div>
          {tanParsed.rest && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              {renderMarkdown(tanParsed.rest)}
            </div>
          )}
        </div>
      )}

      {/* 3連複結果 */}
      {pukuParsed && pukuParsed.picks.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {pukuParsed.picks.slice(0, 3).map((pick, i) => (
              <div key={i} className="rounded-xl border-2 border-purple-300 bg-purple-50 p-3 text-center">
                <span className="text-xl">{['🐴', '🐴', '🐴'][i]}</span>
                <p className="text-xs text-gray-500 mt-0.5">軸{i + 1}</p>
                <p className="text-sm font-bold text-gray-900 mt-1 leading-tight">{pick.name}</p>
                <p className="text-xs text-gray-500 mt-1 leading-snug">{pick.reason}</p>
              </div>
            ))}
          </div>
          {pukuParsed.rest && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              {renderMarkdown(pukuParsed.rest)}
            </div>
          )}
        </div>
      )}

      {/* フォールバック（タグなしで返ってきた場合） */}
      {done && !loading && tanParsed?.picks.length === 0 && pukuParsed?.picks.length === 0 && previewText && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          {renderMarkdown(previewText)}
        </div>
      )}
    </div>
  )
}
